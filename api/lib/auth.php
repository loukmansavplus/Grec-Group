<?php
// Comptes et sessions. Les mots de passe de l'ancien site (SHA-512 sans sel) restent valides : à la première connexion
// ils sont remplacés par un hachage moderne (bcrypt).

function session_boot()
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('grec_sid');
    $life = 60 * 60 * 24 * 30;
    @ini_set('session.gc_maxlifetime', (string) $life);
    $secure = (bool) cfg('cookie_secure');
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params(array('lifetime' => $life, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax'));
    } else {
        session_set_cookie_params($life, '/; samesite=Lax', '', $secure, true);
    }
    session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
}

function current_uid()
{
    session_boot();
    if (empty($_SESSION['uid'])) return null;
    $r = q('SELECT disabled FROM app_user WHERE uid = ?', array($_SESSION['uid']))->fetch();
    if (!$r || (int) $r['disabled'] === 1) { unset($_SESSION['uid']); return null; }
    return $_SESSION['uid'];
}

function public_user($row)
{
    if (!$row) return null;
    return array(
        'uid' => $row['uid'], 'email' => $row['email'], 'displayName' => $row['display_name'],
        'photoURL' => $row['photo_url'] === '' ? null : $row['photo_url'], 'emailVerified' => (bool) $row['email_verified'],
    );
}

function user_by_uid($uid)
{
    return q('SELECT * FROM app_user WHERE uid = ?', array($uid))->fetch();
}

function require_csrf()
{
    session_boot();
    $h = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : '';
    if (!hash_equals($_SESSION['csrf'], $h)) fail(403, 'csrf', 'Jeton de sécurité invalide : rechargez la page.');
}

// Limitation des tentatives (anti force brute) : $max essais par fenêtre de $minutes minutes pour une clé donnée.
function attempts_exceeded($key, $max, $minutes)
{
    $since = now_ms() - $minutes * 60000;
    $n = (int) q('SELECT COUNT(*) AS n FROM app_attempt WHERE k = ? AND ts_ms > ?', array($key, $since))->fetch()['n'];
    return $n >= $max;
}

function record_attempt($key)
{
    q('INSERT INTO app_attempt (k, ts_ms) VALUES (?, ?)', array($key, now_ms()));
    if (mt_rand(1, 50) === 1) q('DELETE FROM app_attempt WHERE ts_ms < ?', array(now_ms() - 86400000));
}

function login_session($uid)
{
    session_boot();
    session_regenerate_id(true);
    $_SESSION['uid'] = $uid;
    $_SESSION['csrf'] = bin2hex(random_bytes(24));
    q('UPDATE app_user SET last_login_ms = ? WHERE uid = ?', array(now_ms(), $uid));
}

function auth_error($status, $code)
{
    fail($status, $code, $code);
}

// Compte migré (uid legacy-m<id> / legacy-a<id>) : vérifie le mot de passe saisi contre le SHA-512 de l'ancienne table.
// La table d'origine n'est jamais modifiée. Si elle est absente (base de test), la réponse est simplement non.
function legacy_password_ok($uid, $password)
{
    if (!preg_match('/^legacy-([ma])(\d+)$/', (string) $uid, $m)) return false;
    try {
        $sql = $m[1] === 'm' ? 'SELECT password FROM g_membre WHERE id_membre = ?' : 'SELECT password FROM g_admin WHERE id_admin = ?';
        $r = q($sql, array((int) $m[2]))->fetch();
    } catch (Exception $e) {
        return false;
    }
    return $r && preg_match('/^[0-9a-f]{128}$/i', (string) $r['password']) && hash_equals(strtolower($r['password']), hash('sha512', $password));
}

function do_login($email, $password)
{
    $email = strtolower(trim((string) $email));
    $ipKey = 'ip:' . client_ip();
    $mailKey = 'login:' . $email;
    if (attempts_exceeded($mailKey, 8, 15) || attempts_exceeded($ipKey, 40, 15)) auth_error(429, 'auth/too-many-requests');
    $u = $email === '' ? false : q('SELECT * FROM app_user WHERE email = ?', array($email))->fetch();
    $ok = false;
    if ($u && (int) $u['disabled'] === 0) {
        if (!empty($u['pass_hash']) && password_verify((string) $password, $u['pass_hash'])) {
            $ok = true;
            if (password_needs_rehash($u['pass_hash'], PASSWORD_DEFAULT)) {
                q('UPDATE app_user SET pass_hash = ? WHERE uid = ?', array(password_hash((string) $password, PASSWORD_DEFAULT), $u['uid']));
            }
        } elseif (!empty($u['pass_sha512']) && hash_equals(strtolower($u['pass_sha512']), hash('sha512', (string) $password))) {
            $ok = true; // mot de passe de l'ancien site : on le remplace par un hachage moderne
            q('UPDATE app_user SET pass_hash = ?, pass_sha512 = NULL WHERE uid = ?', array(password_hash((string) $password, PASSWORD_DEFAULT), $u['uid']));
        } elseif (empty($u['pass_hash']) && empty($u['pass_sha512']) && (legacy_password_ok($u['uid'], (string) $password) || legacy_login_match($email, (string) $password))) {
            $ok = true; // mot de passe lu dans les anciennes tables g_membre / g_admin (même base), puis remplacé par un hachage moderne
            q('UPDATE app_user SET pass_hash = ? WHERE uid = ?', array(password_hash((string) $password, PASSWORD_DEFAULT), $u['uid']));
        }
    } elseif (!$u && $email !== '' && valid_email($email) && ($match = legacy_login_match($email, (string) $password))) {
        // compte créé sur l'ancien site (inscription récente, ou jamais migré) : on le crée ici avec les mêmes données
        $newUid = legacy_provision($email, $match, (string) $password);
        $u = user_by_uid($newUid);
        $ok = true;
    }
    if (!$ok) { record_attempt($mailKey); record_attempt($ipKey); auth_error(401, 'auth/invalid-credential'); }
    login_session($u['uid']);
    return public_user(user_by_uid($u['uid']));
}

function do_register($email, $password, $displayName)
{
    $email = strtolower(trim((string) $email));
    if (!valid_email($email)) auth_error(400, 'auth/invalid-email');
    if (!is_string($password) || strlen($password) < 8) auth_error(400, 'auth/weak-password');
    $ipKey = 'reg:' . client_ip();
    if (attempts_exceeded($ipKey, 10, 60)) auth_error(429, 'auth/too-many-requests');
    if (q('SELECT uid FROM app_user WHERE email = ?', array($email))->fetch()) auth_error(409, 'auth/email-already-in-use');
    record_attempt($ipKey);
    $uid = 'u' . rand_id(20);
    q('INSERT INTO app_user (uid, email, pass_hash, display_name, created_ms) VALUES (?,?,?,?,?)',
        array($uid, $email, password_hash($password, PASSWORD_DEFAULT), mb_substr(trim((string) $displayName), 0, 255), now_ms()));
    login_session($uid);
    return public_user(user_by_uid($uid));
}

function make_token($uid, $kind, $ttlMs)
{
    $token = bin2hex(random_bytes(32));
    q('INSERT INTO app_reset (token_hash, uid, expires_ms, used, kind) VALUES (?,?,?,0,?)', array(hash('sha256', $token), $uid, now_ms() + $ttlMs, $kind));
    return $token;
}

function do_reset_request($email)
{
    $email = strtolower(trim((string) $email));
    if (!valid_email($email)) return; // pas d'indication à l'appelant
    $key = 'reset:' . $email;
    if (attempts_exceeded($key, 3, 60) || attempts_exceeded('resetip:' . client_ip(), 20, 60)) return;
    record_attempt($key); record_attempt('resetip:' . client_ip());
    $u = q('SELECT uid FROM app_user WHERE email = ? AND disabled = 0', array($email))->fetch();
    if (!$u) return;
    $token = make_token($u['uid'], 'reset', 3600000);
    $url = rtrim(cfg('site_url'), '/') . '/pages/reset-password.html?token=' . $token;
    send_mail($email, 'Réinitialisation de votre mot de passe GREC',
        mail_template('Réinitialisation du mot de passe', 'Vous avez demandé à choisir un nouveau mot de passe pour votre compte GREC. Ce lien est valable une heure.', 'Choisir un nouveau mot de passe', $url));
}

function do_reset_confirm($token, $password)
{
    if (!is_string($password) || strlen($password) < 8) auth_error(400, 'auth/weak-password');
    $h = hash('sha256', (string) $token);
    $r = q('SELECT * FROM app_reset WHERE token_hash = ? AND kind = ? AND used = 0 AND expires_ms > ?', array($h, 'reset', now_ms()))->fetch();
    if (!$r) auth_error(400, 'auth/invalid-action-code');
    q('UPDATE app_user SET pass_hash = ?, pass_sha512 = NULL WHERE uid = ?', array(password_hash($password, PASSWORD_DEFAULT), $r['uid']));
    q('UPDATE app_reset SET used = 1 WHERE uid = ? AND kind = ?', array($r['uid'], 'reset'));
}

function do_send_verification($uid)
{
    $u = user_by_uid($uid);
    if (!$u || (int) $u['email_verified'] === 1) return;
    if (attempts_exceeded('verify:' . $uid, 3, 60)) return;
    record_attempt('verify:' . $uid);
    $token = make_token($uid, 'verify', 86400000 * 3);
    $url = rtrim(cfg('site_url'), '/') . '/api/auth/verify-email?token=' . $token;
    send_mail($u['email'], 'Confirmez votre adresse e-mail GREC',
        mail_template('Confirmez votre adresse e-mail', 'Merci pour votre inscription au GREC. Confirmez votre adresse e-mail en cliquant sur le bouton ci-dessous.', 'Confirmer mon adresse', $url));
}

function do_verify_email($token)
{
    $h = hash('sha256', (string) $token);
    $r = q('SELECT * FROM app_reset WHERE token_hash = ? AND kind = ? AND used = 0 AND expires_ms > ?', array($h, 'verify', now_ms()))->fetch();
    if (!$r) return false;
    q('UPDATE app_user SET email_verified = 1 WHERE uid = ?', array($r['uid']));
    q('UPDATE app_reset SET used = 1 WHERE token_hash = ?', array($h));
    return true;
}
