<?php
// Rapatrie sur l'hébergement OVH les images encore hébergées chez Cloudinary (photos de membres, actualités, galerie…)
// et remplace leurs adresses dans la base. À copier temporairement dans api/ (avec api/lib/), à appeler une fois, puis à supprimer.
//   .../api/images-vers-ovh.php?k=<20 premiers caractères de sha256(secret)>            -> simulation (rien n'est modifié)
//   .../api/images-vers-ovh.php?k=<…>&go=1                                              -> migration réelle
// Les images restent chez Cloudinary : seules les adresses en base changent, donc retour en arrière possible.

error_reporting(E_ALL);
ini_set('display_errors', '0');
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/store.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/upload.php';

header('Content-Type: text/plain; charset=utf-8');
if (!isset($_GET['k']) || !hash_equals(substr(hash('sha256', (string) cfg('secret')), 0, 20), (string) $_GET['k'])) { http_response_code(403); exit("Accès refusé\n"); }
set_time_limit(280);
$go = isset($_GET['go']);

function fetch_image($url)
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 25, CURLOPT_USERAGENT => 'GREC-migration'));
        $b = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($b !== false && $code === 200) ? $b : null;
    }
    $b = @file_get_contents($url, false, stream_context_create(array('http' => array('timeout' => 25, 'user_agent' => 'GREC-migration'))));
    return $b === false ? null : $b;
}

// Dossier de rangement selon la collection d'origine.
function folder_for($coll)
{
    $map = array('membres' => 'membres', 'annuaire' => 'membres', 'actualites' => 'actualites', 'evenements' => 'evenements', 'galerie' => 'galerie', 'partenaires' => 'partenaires');
    return isset($map[$coll]) ? $map[$coll] : 'divers';
}

$rows = q("SELECT coll, id, data FROM app_doc WHERE data LIKE '%res.cloudinary.com%'")->fetchAll();
$users = q("SELECT uid, photo_url FROM app_user WHERE photo_url LIKE '%res.cloudinary.com%'")->fetchAll();
$found = array(); // url => dossier
foreach ($rows as $r) {
    $text = str_replace('\\/', '/', $r['data']);
    if (preg_match_all('#https://res\.cloudinary\.com/[^"\\\\\s]+#', $text, $m)) foreach ($m[0] as $u) if (!isset($found[$u])) $found[$u] = folder_for($r['coll']);
}
foreach ($users as $u) if (!isset($found[$u['photo_url']])) $found[$u['photo_url']] = 'membres';
echo count($rows) . " documents et " . count($users) . " comptes contiennent une adresse Cloudinary ; " . count($found) . " images distinctes.\n";

$map = array();
$fail = 0;
$tmp = sys_get_temp_dir() . '/grec-mig-' . bin2hex(random_bytes(4));
foreach ($found as $url => $folder) {
    if (!$go) { echo "  à migrer : $url -> $folder\n"; continue; }
    $bytes = fetch_image($url);
    if ($bytes === null) { $fail++; echo "  ÉCHEC téléchargement : $url\n"; continue; }
    file_put_contents($tmp, $bytes);
    $rel = upload_store($tmp, $folder, true);
    if (!$rel) { $fail++; echo "  ÉCHEC image invalide : $url\n"; continue; }
    $map[$url] = rtrim(cfg('site_url'), '/') . '/uploads/' . $rel;
    echo "  ok : $url -> " . $map[$url] . "\n";
}
@unlink($tmp);

if ($go && $map) {
    $n = 0;
    db()->beginTransaction();
    foreach ($rows as $r) {
        $new = $r['data'];
        foreach ($map as $old => $nu) $new = str_replace(array($old, str_replace('/', '\\/', $old)), array($nu, str_replace('/', '\\/', $nu)), $new);
        if ($new !== $r['data'] && json_decode($new, true) !== null) { q('UPDATE app_doc SET data = ? WHERE coll = ? AND id = ?', array($new, $r['coll'], $r['id'])); $n++; }
    }
    foreach ($users as $u) if (isset($map[$u['photo_url']])) { q('UPDATE app_user SET photo_url = ? WHERE uid = ?', array($map[$u['photo_url']], $u['uid'])); $n++; }
    db()->commit();
    echo "\n$n enregistrements mis à jour, $fail échec(s).\n";
} elseif ($go) {
    echo "\nRien à mettre à jour ($fail échec(s)).\n";
}
