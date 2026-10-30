<?php
// Reflet des membres dans l'ancienne table g_membre (même base) : les inscriptions, validations et suppressions
// faites sur le nouveau site restent visibles dans l'ancienne base. Ne fait jamais échouer l'opération principale.

function legacy_available()
{
    static $ok = null;
    if ($ok === null) {
        $c = cfg();
        if (empty($c['legacy_mirror'])) return $ok = false; // activé seulement dans la config du vrai site
        try { q('SELECT 1 FROM g_membre LIMIT 1'); $ok = true; } catch (Exception $e) { $ok = false; }
    }
    return $ok;
}

function legacy_clean($v, $max)
{
    return mb_substr(trim((string) $v), 0, $max);
}

// $data = document complet du membre après écriture. Retourne rien.
function legacy_mirror_member($uid, $data)
{
    try {
        if (!legacy_available() || !is_array($data)) return;
        $statut = (isset($data['statut']) && $data['statut'] === 'actif') ? 1 : 0;
        $f = array(
            legacy_clean(isset($data['nom']) ? $data['nom'] : '', 255), legacy_clean(isset($data['telephone']) ? $data['telephone'] : '', 30),
            legacy_clean(isset($data['email']) ? $data['email'] : '', 255), legacy_clean(isset($data['pays']) ? $data['pays'] : '', 100),
            legacy_clean(isset($data['secteur']) ? $data['secteur'] : '', 255), trim(isset($data['bio']) ? (string) $data['bio'] : ''), $statut,
        );
        $gid = isset($data['legacyId']) ? (int) $data['legacyId'] : 0;
        if ($gid > 0) {
            q('UPDATE g_membre SET nom_prenom = ?, phone = ?, email = ?, pays = ?, activite = ?, presentation = ?, statut = ? WHERE id_membre = ?', array_merge($f, array($gid)));
            return;
        }
        q("INSERT INTO g_membre (nom_prenom, phone, email, password, pays, activite, presentation, statut, datecreated) VALUES (?,?,?,'',?,?,?,?,NOW())",
            array($f[0], $f[1], $f[2], $f[3], $f[4], $f[5], $f[6]));
        $gid = (int) db()->lastInsertId();
        if ($gid > 0) { // mémorise le lien dans le document (écriture serveur directe)
            $data['legacyId'] = $gid;
            doc_put('membres', $uid, $data);
        }
    } catch (Exception $e) {
        error_log('GREC legacy mirror: ' . $e->getMessage());
    }
}

function legacy_delete_member($data)
{
    try {
        $gid = (is_array($data) && isset($data['legacyId'])) ? (int) $data['legacyId'] : 0;
        if ($gid > 0 && legacy_available()) q('DELETE FROM g_membre WHERE id_membre = ?', array($gid));
    } catch (Exception $e) {
        error_log('GREC legacy delete: ' . $e->getMessage());
    }
}

// ---- Connexion avec un compte de l'ancien site (même base) ----

function legacy_hash_ok($stored, $password)
{
    return preg_match('/^[0-9a-f]{128}$/i', (string) $stored) && hash_equals(strtolower($stored), hash('sha512', (string) $password));
}

// Cherche dans g_admin puis g_membre une ligne de cette adresse dont le mot de passe correspond. Retourne array('kind'=>'a'|'m', 'row'=>...) ou null.
// Les tables d'origine ne sont jamais modifiées ; les erreurs (table absente en test) donnent simplement « non ».
function legacy_login_match($email, $password)
{
    try {
        foreach (q('SELECT * FROM g_admin WHERE LOWER(email) = ? AND statut = 1 LIMIT 5', array($email))->fetchAll() as $r) {
            if (legacy_hash_ok($r['password'], $password)) return array('kind' => 'a', 'row' => $r);
        }
        foreach (q('SELECT * FROM g_membre WHERE LOWER(email) = ? ORDER BY id_membre DESC LIMIT 20', array($email))->fetchAll() as $r) {
            if (legacy_hash_ok($r['password'], $password)) return array('kind' => 'm', 'row' => $r);
        }
    } catch (Exception $e) {
        return null;
    }
    return null;
}

// Crée le compte et les fiches du nouveau site pour un compte de l'ancien site qui se connecte pour la première fois. Retourne l'uid.
function legacy_provision($email, $match, $password)
{
    $r = $match['row'];
    $now = now_ms();
    $uid = ($match['kind'] === 'a' ? 'legacy-a' : 'legacy-m') . (int) ($match['kind'] === 'a' ? $r['id_admin'] : $r['id_membre']);
    if (q('SELECT uid FROM app_user WHERE uid = ?', array($uid))->fetch()) $uid .= '-' . rand_id(6);
    $name = trim((string) $r['nom_prenom']);
    q('INSERT INTO app_user (uid, email, pass_hash, display_name, email_verified, created_ms) VALUES (?,?,?,?,1,?)',
        array($uid, $email, password_hash((string) $password, PASSWORD_DEFAULT), mb_substr($name, 0, 255), $now));
    if ($match['kind'] === 'a') {
        doc_put('admins', $uid, array('uid' => $uid, 'email' => $email, 'name' => $name, 'role' => 'admin', 'active' => true,
            'legacyType' => (string) $r['type_cmpte'], 'legacyId' => (int) $r['id_admin'], 'legacySource' => 'ancien-site-php', 'createdAt' => array('__ts' => $now)));
        return $uid;
    }
    $created = (!empty($r['datecreated']) && strtotime($r['datecreated'] . ' UTC') !== false) ? strtotime($r['datecreated'] . ' UTC') * 1000 : $now;
    $statut = ((int) $r['statut'] === 1) ? 'actif' : 'en_attente';
    $m = array('nom' => $name, 'prenom' => '', 'nomFamille' => '', 'email' => $email, 'telephone' => trim((string) $r['phone']), 'pays' => trim((string) $r['pays']),
        'secteur' => trim((string) $r['activite']), 'bio' => trim((string) $r['presentation']), 'poste' => '', 'ville' => '', 'statut' => $statut, 'codeEthique' => true,
        'role' => 'membre', 'publicProfileEnabled' => true, 'showPhoto' => true, 'showBio' => true, 'showLocation' => true, 'legacyId' => (int) $r['id_membre'],
        'legacySource' => 'ancien-site-php', 'createdAt' => array('__ts' => $created), 'updatedAt' => array('__ts' => $now));
    doc_put('membres', $uid, $m);
    if ($statut === 'actif') {
        doc_put('annuaire', $uid, array('nom' => $name, 'secteur' => $m['secteur'], 'pays' => $m['pays'], 'ville' => '', 'poste' => '', 'bio' => $m['bio'],
            'showPhoto' => true, 'showBio' => true, 'showLocation' => true, 'createdAt' => array('__ts' => $created), 'updatedAt' => array('__ts' => $now)));
    }
    return $uid;
}
