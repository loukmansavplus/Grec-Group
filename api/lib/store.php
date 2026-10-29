<?php
// Stockage des documents (collections / sous-collections) dans la table app_doc.
// Chaque document garde son JSON complet (data) + 2 clés de filtre (k1, k2) + 1 clé de tri (ord), indexées.

// Pour chaque collection : quels champs servent de clé de filtre / de tri.
function index_config($coll)
{
    $map = array(
        'membres'       => array('k1' => 'email', 'k1lower' => true, 'k2' => 'statut', 'ord' => 'createdAt'),
        'annuaire'      => array('ord' => 'createdAt'),
        'admins'        => array('k1' => 'email', 'k1lower' => true),
        'actualites'    => array('k1' => 'publie', 'k2' => 'authorUid', 'ord' => 'publishedAt'),
        'evenements'    => array('k1' => 'publie', 'k2' => 'authorUid', 'ord' => 'date'),
        'contributions' => array('k1' => 'authorUid', 'k2' => 'validationStatus', 'ord' => 'createdAt'),
        'galerie'       => array('ord' => 'uploadedAt'),
        'partenaires'   => array('ord' => 'createdAt'),
        'newsletter'    => array('k1' => 'email', 'k1lower' => true, 'ord' => 'subscribedAt'),
        'contacts'      => array('ord' => 'createdAt'),
        'ACTION_LOG'    => array('ord' => 'timestamp'),
        'chats'         => array('k1' => 'participants[0]', 'k2' => 'participants[1]', 'array' => 'participants', 'ord' => 'updatedAt'),
        'chats/*/messages' => array('ord' => 'createdAt'),
    );
    if (preg_match('#^chats/[^/]+/messages$#', $coll)) return $map['chats/*/messages'];
    return isset($map[$coll]) ? $map[$coll] : array();
}

// Découpe un chemin en [collection, id] (document) ou [collection, null] (collection).
function parse_path($path, $expectDoc)
{
    $path = trim((string) $path, '/');
    $seg = $path === '' ? array() : explode('/', $path);
    foreach ($seg as $s) {
        if (!preg_match('/^[A-Za-z0-9_.\-]{1,120}$/', $s)) fail(400, 'bad-path', 'Chemin invalide');
    }
    $n = count($seg);
    if ($n === 0 || $n > 4) fail(400, 'bad-path', 'Chemin invalide');
    $isDoc = ($n % 2 === 0);
    if ($expectDoc && !$isDoc) fail(400, 'bad-path', 'Un document est attendu');
    if (!$expectDoc && $isDoc) fail(400, 'bad-path', 'Une collection est attendue');
    if ($isDoc) return array(implode('/', array_slice($seg, 0, $n - 1)), $seg[$n - 1]);
    return array(implode('/', $seg), null);
}

function get_field($data, $spec)
{
    if (preg_match('/^([A-Za-z0-9_]+)\[(\d+)\]$/', $spec, $m)) {
        return (isset($data[$m[1]]) && is_array($data[$m[1]]) && isset($data[$m[1]][(int) $m[2]])) ? $data[$m[1]][(int) $m[2]] : null;
    }
    return isset($data[$spec]) ? $data[$spec] : null;
}

function key_norm($v, $lower = false)
{
    if ($v === null) return null;
    if (is_bool($v)) return $v ? '1' : '0';
    if (is_array($v)) return null;
    $s = (string) $v;
    if ($lower) $s = strtolower(trim($s));
    return mb_substr($s, 0, 190);
}

function ord_value($v)
{
    if ($v === null) return null;
    if (is_array($v)) return isset($v['__ts']) ? (int) $v['__ts'] : null;
    if (is_int($v) || is_float($v)) return (int) $v;
    if (is_string($v) && $v !== '') {
        if (is_numeric($v)) return (int) $v;
        $t = strtotime($v);
        return $t === false ? null : $t * 1000;
    }
    return null;
}

function index_keys($coll, $data)
{
    $c = index_config($coll);
    $k1 = isset($c['k1']) ? key_norm(get_field($data, $c['k1']), !empty($c['k1lower'])) : null;
    $k2 = isset($c['k2']) ? key_norm(get_field($data, $c['k2']), !empty($c['k2lower'])) : null;
    $ord = isset($c['ord']) ? ord_value(get_field($data, $c['ord'])) : null;
    return array($k1, $k2, $ord);
}

function doc_get($coll, $id)
{
    $r = q('SELECT data FROM app_doc WHERE coll = ? AND id = ?', array($coll, $id))->fetch();
    if (!$r) return null;
    $d = json_decode($r['data'], true);
    return is_array($d) ? $d : array();
}

function doc_put($coll, $id, $data)
{
    list($k1, $k2, $ord) = index_keys($coll, $data);
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    q('INSERT INTO app_doc (coll, id, data, k1, k2, ord, updated_ms) VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), k1 = VALUES(k1), k2 = VALUES(k2), ord = VALUES(ord), updated_ms = VALUES(updated_ms)',
        array($coll, $id, $json, $k1, $k2, $ord, now_ms()));
}

function doc_delete($coll, $id)
{
    q('DELETE FROM app_doc WHERE coll = ? AND id = ?', array($coll, $id));
    // suppression des sous-collections éventuelles (ex. messages d'une conversation)
    q('DELETE FROM app_doc WHERE coll LIKE ?', array($coll . '/' . $id . '/%'));
}

function loose_equal($a, $b)
{
    if (is_bool($a) || is_bool($b)) return $a === $b;
    if ($a === null || $b === null) return $a === $b;
    if (is_array($a) || is_array($b)) return $a === $b;
    return (string) $a === (string) $b;
}

// Exécute une requête : $where = [[champ, op, valeur]], $orders = [[champ, 'asc'|'desc']].
// Retourne une liste de [id, data]. Les filtres sur champs non indexés sont appliqués en PHP.
function doc_query($coll, $where, $orders, $limit)
{
    $cfg = index_config($coll);
    $sql = 'SELECT id, data FROM app_doc WHERE coll = ?';
    $params = array($coll);
    $post = array();
    foreach ($where as $w) {
        $f = $w[0]; $op = $w[1]; $v = $w[2];
        if ($op === '==' && isset($cfg['k1']) && $f === preg_replace('/\[\d+\]$/', '', $cfg['k1']) && strpos($cfg['k1'], '[') === false) {
            $sql .= ' AND k1 = ?'; $params[] = key_norm($v, !empty($cfg['k1lower']));
        } elseif ($op === '==' && isset($cfg['k2']) && $f === $cfg['k2']) {
            $sql .= ' AND k2 = ?'; $params[] = key_norm($v, !empty($cfg['k2lower']));
        } elseif ($op === 'array-contains' && isset($cfg['array']) && $f === $cfg['array']) {
            $sql .= ' AND (k1 = ? OR k2 = ?)'; $params[] = key_norm($v); $params[] = key_norm($v);
        } else {
            $post[] = $w;
        }
    }
    $order = count($orders) ? $orders[0] : null;
    $sqlOrdered = false;
    if ($order && isset($cfg['ord']) && $order[0] === $cfg['ord'] && count($orders) === 1) {
        $sql .= ' AND ord IS NOT NULL ORDER BY ord ' . ($order[1] === 'desc' ? 'DESC' : 'ASC') . ', id ASC';
        $sqlOrdered = true;
    }
    $limit = ($limit !== null && (int) $limit > 0) ? (int) $limit : null;
    if ($limit !== null && $sqlOrdered && !count($post)) {
        $sql .= ' LIMIT ' . $limit;
    } elseif (!$sqlOrdered && !count($post) && !$order && $limit !== null) {
        $sql .= ' ORDER BY id ASC LIMIT ' . $limit;
    } else {
        $sql .= $sqlOrdered ? '' : ' ORDER BY id ASC';
        $sql .= ' LIMIT 50000';
    }
    $rows = q($sql, $params)->fetchAll();
    $out = array();
    foreach ($rows as $r) {
        $d = json_decode($r['data'], true);
        if (!is_array($d)) $d = array();
        $ok = true;
        foreach ($post as $w) {
            $val = isset($d[$w[0]]) ? $d[$w[0]] : null;
            if ($w[1] === '==') { if (!loose_equal($val, $w[2])) { $ok = false; break; } }
            elseif ($w[1] === 'array-contains') { if (!(is_array($val) && in_array($w[2], $val, true))) { $ok = false; break; } }
            elseif ($w[1] === 'in') { if (!(is_array($w[2]) && in_array($val, $w[2], true))) { $ok = false; break; } }
            elseif ($w[1] === '!=') { if (loose_equal($val, $w[2])) { $ok = false; break; } }
            else { $ok = false; break; }
        }
        if ($ok) $out[] = array($r['id'], $d);
    }
    if (!$sqlOrdered && $order) {
        $field = $order[0];
        $out = array_values(array_filter($out, function ($x) use ($field) { return isset($x[1][$field]) && $x[1][$field] !== null; }));
        $dir = $order[1] === 'desc' ? -1 : 1;
        usort($out, function ($a, $b) use ($field, $dir) {
            $va = ord_value($a[1][$field]); $vb = ord_value($b[1][$field]);
            if ($va === null && $vb === null) { $va = (string) $a[1][$field]; $vb = (string) $b[1][$field]; }
            if ($va == $vb) return strcmp($a[0], $b[0]);
            return ($va < $vb ? -1 : 1) * $dir;
        });
    }
    if ($limit !== null) $out = array_slice($out, 0, $limit);
    return $out;
}
