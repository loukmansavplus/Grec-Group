<?php
// Importe un export JSON (comptes + documents) dans les tables de l'API, avec exactement la même logique d'indexation que l'API.
// Ligne de commande uniquement. Usage : php api/tools/import-dump.php chemin/firebase-export.json [--replace]
//   --replace : vide d'abord app_user, app_doc, app_reset, app_attempt (à n'utiliser que sur une base de test ou avant la bascule).
if (php_sapi_name() !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/lib/util.php';
require dirname(__DIR__) . '/lib/db.php';
require dirname(__DIR__) . '/lib/store.php';

$file = isset($argv[1]) ? $argv[1] : '';
if (!is_file($file)) { fwrite(STDERR, "Fichier d'export introuvable.\n"); exit(1); }
$dump = json_decode(file_get_contents($file), true);
if (!is_array($dump) || !isset($dump['users'], $dump['docs'])) { fwrite(STDERR, "Export invalide.\n"); exit(1); }

if (in_array('--replace', $argv, true)) {
    foreach (array('app_attempt', 'app_reset', 'app_doc', 'app_user') as $t) db()->exec("TRUNCATE TABLE $t");
}
db()->beginTransaction();
$nu = 0;
foreach ($dump['users'] as $u) {
    if (empty($u['email'])) continue;
    q('INSERT INTO app_user (uid, email, pass_hash, pass_sha512, display_name, photo_url, email_verified, disabled, created_ms)
       VALUES (?,?,NULL,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE email = VALUES(email), pass_sha512 = VALUES(pass_sha512), display_name = VALUES(display_name),
         photo_url = VALUES(photo_url), email_verified = VALUES(email_verified), disabled = VALUES(disabled)',
        array($u['uid'], strtolower($u['email']), isset($u['sha512']) ? $u['sha512'] : null, $u['displayName'], $u['photoURL'], $u['emailVerified'] ? 1 : 0, $u['disabled'] ? 1 : 0, (int) $u['createdMs']));
    $nu++;
}
$nd = 0;
foreach ($dump['docs'] as $d) {
    list($coll, $id) = parse_path($d['path'], true);
    doc_put($coll, $id, $d['data']);
    $nd++;
}
db()->commit();
echo "Import : $nu comptes, $nd documents.\n";
