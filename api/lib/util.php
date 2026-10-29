<?php
// Outils communs de l'API GREC. Code volontairement compatible PHP 7.4+ (hébergement OVH).

function cfg($key = null)
{
    static $c = null;
    if ($c === null) {
        $f = dirname(__DIR__) . '/config.php';
        if (!is_file($f)) {
            json_out(500, array('error' => array('code' => 'config-missing', 'message' => 'api/config.php manquant')));
        }
        $c = require $f;
    }
    if ($key === null) return $c;
    return isset($c[$key]) ? $c[$key] : null;
}

function now_ms()
{
    return (int) round(microtime(true) * 1000);
}

function json_out($status, $data)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($status, $code, $message = '')
{
    json_out($status, array('error' => array('code' => $code, 'message' => $message)));
}

function body()
{
    static $b = null;
    if ($b === null) {
        $raw = file_get_contents('php://input');
        if ($raw === '' || $raw === false) {
            $b = array();
        } else {
            $b = json_decode($raw, true);
            if (!is_array($b)) fail(400, 'bad-request', 'JSON invalide');
        }
    }
    return $b;
}

function rand_id($n = 20)
{
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $bytes = random_bytes($n);
    $s = '';
    for ($i = 0; $i < $n; $i++) $s .= $chars[ord($bytes[$i]) % 62];
    return $s;
}

function is_assoc($a)
{
    return is_array($a) && $a !== array() && array_keys($a) !== range(0, count($a) - 1);
}

function deep_merge($a, $b)
{
    foreach ($b as $k => $v) {
        if (isset($a[$k]) && is_assoc($a[$k]) && is_assoc($v)) $a[$k] = deep_merge($a[$k], $v);
        else $a[$k] = $v;
    }
    return $a;
}

// Remplace les marqueurs {"__sv": true} (serverTimestamp) par l'heure du serveur, récursivement.
function resolve_sentinels($v, $nowMs)
{
    if (!is_array($v)) return $v;
    if (isset($v['__sv']) && count($v) === 1) return array('__ts' => $nowMs);
    foreach ($v as $k => $x) $v[$k] = resolve_sentinels($x, $nowMs);
    return $v;
}

function client_ip()
{
    return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
}

function valid_email($e)
{
    return is_string($e) && strlen($e) <= 254 && preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $e) === 1;
}
