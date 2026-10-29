<?php
// API GREC : comptes + documents (remplace Firebase Authentication / Firestore). Point d'entrée unique.
// Tout passe en JSON, même origine que le site (cookie de session HttpOnly + jeton CSRF).

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/store.php';
require __DIR__ . '/lib/legacy.php';
require __DIR__ . '/lib/policy.php';
require __DIR__ . '/lib/mail.php';
require __DIR__ . '/lib/auth.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

// --- route demandée (ex. /api/auth/login -> "auth/login")
$path = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
$route = '';
$pos = strpos($path, '/api/');
if ($pos !== false) $route = substr($path, $pos + 5);
elseif (isset($_GET['r'])) $route = $_GET['r'];
$route = trim($route, '/');
if (substr($route, 0, 9) === 'index.php') $route = trim(substr($route, 9), '/');
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

function read_where($raw)
{
    $out = array();
    if (!is_array($raw)) return $out;
    foreach ($raw as $w) {
        if (!is_array($w) || count($w) !== 3 || !is_string($w[0]) || !in_array($w[1], array('==', 'array-contains', 'in', '!='), true)) fail(400, 'bad-query', 'Filtre invalide');
        $out[] = array($w[0], $w[1], $w[2]);
    }
    return $out;
}

function read_orders($raw)
{
    $out = array();
    if (!is_array($raw)) return $out;
    foreach ($raw as $o) {
        if (!is_array($o) || !isset($o[0]) || !is_string($o[0])) fail(400, 'bad-query', 'Tri invalide');
        $out[] = array($o[0], (isset($o[1]) && $o[1] === 'desc') ? 'desc' : 'asc');
    }
    return $out;
}

function doc_size_ok($data)
{
    return strlen(json_encode($data)) <= 1000000;
}

// Applique une écriture (set / add / update) en respectant les droits ; retourne l'identifiant.
function apply_set($coll, $id, $data, $merge, $uid)
{
    if (!is_array($data)) fail(400, 'bad-request', 'Données invalides');
    $data = resolve_sentinels($data, now_ms());
    $old = doc_get($coll, $id);
    $new = ($merge && $old !== null) ? deep_merge($old, $data) : $data;
    if (!doc_size_ok($new)) fail(413, 'too-large', 'Document trop volumineux');
    $op = $old === null ? 'create' : 'update';
    if (!$uid) { // visiteurs : formulaires publics (newsletter, contact) limités par adresse IP
        if (attempts_exceeded('anonw:' . client_ip(), 30, 60)) fail(429, 'resource-exhausted', 'Trop de requêtes, réessayez plus tard.');
        record_attempt('anonw:' . client_ip());
    }
    if (!can_write($op, $coll, $id, $old, $new, $uid)) fail(403, 'permission-denied', 'Missing or insufficient permissions.');
    doc_put($coll, $id, $new);
    if ($coll === 'membres') legacy_mirror_member($id, $new);
    return $id;
}

function apply_delete($coll, $id, $uid)
{
    $old = doc_get($coll, $id);
    if ($old === null) return;
    if (!can_write('delete', $coll, $id, $old, null, $uid)) fail(403, 'permission-denied', 'Missing or insufficient permissions.');
    doc_delete($coll, $id);
    if ($coll === 'membres') legacy_delete_member($old);
}

try {
    if ($route === 'health') {
        $ok = (int) q('SELECT 1 AS ok')->fetch()['ok'] === 1;
        json_out(200, array('ok' => $ok, 'php' => PHP_VERSION, 'time' => date('c')));
    }

    if ($route === 'auth/me' && $method === 'GET') {
        session_boot();
        $uid = current_uid();
        json_out(200, array('user' => $uid ? public_user(user_by_uid($uid)) : null, 'csrf' => $_SESSION['csrf']));
    }

    if ($route === 'auth/verify-email' && $method === 'GET') {
        $okv = do_verify_email(isset($_GET['token']) ? $_GET['token'] : '');
        header('Location: ' . rtrim(cfg('site_url'), '/') . '/?email=' . ($okv ? 'confirme' : 'lien-invalide'));
        exit;
    }

    if ($method !== 'POST') fail(405, 'method-not-allowed', 'POST attendu');
    $ct = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    if (stripos($ct, 'application/json') === false) fail(415, 'unsupported-media-type', 'JSON attendu');
    require_csrf();
    $b = body();

    switch ($route) {
        case 'auth/login':
            json_out(200, array('user' => do_login(isset($b['email']) ? $b['email'] : '', isset($b['password']) ? $b['password'] : ''), 'csrf' => $_SESSION['csrf']));
        case 'auth/register':
            json_out(200, array('user' => do_register(isset($b['email']) ? $b['email'] : '', isset($b['password']) ? $b['password'] : '', isset($b['displayName']) ? $b['displayName'] : ''), 'csrf' => $_SESSION['csrf']));
        case 'auth/logout':
            session_boot();
            $_SESSION = array();
            session_regenerate_id(true);
            $_SESSION['csrf'] = bin2hex(random_bytes(24));
            json_out(200, array('ok' => true, 'csrf' => $_SESSION['csrf']));
        case 'auth/profile':
            $uid = current_uid();
            if (!$uid) fail(401, 'auth/requires-login', 'Connexion requise');
            if (isset($b['displayName'])) q('UPDATE app_user SET display_name = ? WHERE uid = ?', array(mb_substr(trim((string) $b['displayName']), 0, 255), $uid));
            if (array_key_exists('photoURL', $b)) {
                $p = (string) $b['photoURL'];
                if ($p !== '' && !preg_match('#^https?://#i', $p)) $p = '';
                q('UPDATE app_user SET photo_url = ? WHERE uid = ?', array(mb_substr($p, 0, 500), $uid));
            }
            json_out(200, array('user' => public_user(user_by_uid($uid))));
        case 'auth/reset':
            do_reset_request(isset($b['email']) ? $b['email'] : '');
            json_out(200, array('ok' => true));
        case 'auth/reset-confirm':
            do_reset_confirm(isset($b['token']) ? $b['token'] : '', isset($b['password']) ? $b['password'] : '');
            json_out(200, array('ok' => true));
        case 'auth/send-verification':
            $uid = current_uid();
            if (!$uid) fail(401, 'auth/requires-login', 'Connexion requise');
            do_send_verification($uid);
            json_out(200, array('ok' => true));

        case 'db/get':
            list($coll, $id) = parse_path(isset($b['path']) ? $b['path'] : '', true);
            $uid = current_uid();
            $data = doc_get($coll, $id);
            if (!can_read_doc($coll, $id, $data, $uid)) fail(403, 'permission-denied', 'Missing or insufficient permissions.');
            json_out(200, array('exists' => $data !== null, 'data' => $data === null ? null : $data));

        case 'db/query':
            list($coll, $unused) = parse_path(isset($b['path']) ? $b['path'] : '', false);
            $uid = current_uid();
            $where = read_where(isset($b['where']) ? $b['where'] : array());
            $orders = read_orders(isset($b['orderBy']) ? $b['orderBy'] : array());
            $limit = isset($b['limit']) ? (int) $b['limit'] : null;
            if (!can_list($coll, $where, $uid)) fail(403, 'permission-denied', 'Missing or insufficient permissions.');
            $rows = doc_query($coll, $where, $orders, $limit);
            $docs = array();
            foreach ($rows as $r) {
                if (!can_read_doc($coll, $r[0], $r[1], $uid)) continue; // seconde barrière par document
                $docs[] = array('id' => $r[0], 'data' => $r[1]);
            }
            json_out(200, array('docs' => $docs));

        case 'db/set':
            list($coll, $id) = parse_path(isset($b['path']) ? $b['path'] : '', true);
            apply_set($coll, $id, isset($b['data']) ? $b['data'] : null, !empty($b['merge']), current_uid());
            json_out(200, array('ok' => true));

        case 'db/add':
            list($coll, $unused) = parse_path(isset($b['path']) ? $b['path'] : '', false);
            $id = rand_id(20);
            apply_set($coll, $id, isset($b['data']) ? $b['data'] : null, false, current_uid());
            json_out(200, array('id' => $id));

        case 'db/delete':
            list($coll, $id) = parse_path(isset($b['path']) ? $b['path'] : '', true);
            apply_delete($coll, $id, current_uid());
            json_out(200, array('ok' => true));

        case 'db/batch':
            $uid = current_uid();
            $ops = isset($b['ops']) && is_array($b['ops']) ? $b['ops'] : array();
            if (count($ops) > 500) fail(400, 'too-many-operations', 'Trop d\'opérations');
            db()->beginTransaction();
            try {
                foreach ($ops as $op) {
                    $type = isset($op['type']) ? $op['type'] : '';
                    list($coll, $id) = parse_path(isset($op['path']) ? $op['path'] : '', true);
                    if ($type === 'set') apply_set($coll, $id, isset($op['data']) ? $op['data'] : null, !empty($op['merge']), $uid);
                    elseif ($type === 'delete') apply_delete($coll, $id, $uid);
                    else fail(400, 'bad-request', 'Opération inconnue');
                }
                db()->commit();
            } catch (Exception $e) {
                if (db()->inTransaction()) db()->rollBack();
                throw $e;
            }
            json_out(200, array('ok' => true));
    }
    fail(404, 'not-found', 'Route inconnue');
} catch (Exception $e) {
    error_log('GREC API: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    fail(500, 'server-error', 'Erreur interne');
}
