<?php
// Prépare une base de TEST (jamais la production) : vide les tables de l'API puis crée quelques comptes et documents.
// Usage : php api/tests/seed.php   (utilise api/config.php)
require dirname(__DIR__) . '/lib/util.php';
require dirname(__DIR__) . '/lib/db.php';
require dirname(__DIR__) . '/lib/store.php';

if (stripos((string) cfg('db_name'), 'dev') === false && stripos((string) cfg('db_name'), 'test') === false) {
    fwrite(STDERR, "ARRET : ce script ne s'exécute que sur une base dont le nom contient 'dev' ou 'test'.\n");
    exit(1);
}
foreach (array('app_attempt', 'app_reset', 'app_doc', 'app_user') as $t) db()->exec("TRUNCATE TABLE $t");
$now = now_ms();
$ts = function ($ms) { return array('__ts' => $ms); };
function mkuser($uid, $email, $name, $pwd, $legacy = false) {
    q('INSERT INTO app_user (uid, email, pass_hash, pass_sha512, display_name, email_verified, created_ms) VALUES (?,?,?,?,?,1,?)',
        array($uid, $email, $legacy ? null : password_hash($pwd, PASSWORD_DEFAULT), $legacy ? hash('sha512', $pwd) : null, $name, now_ms()));
}
mkuser('adm1', 'admin@test.local', 'Admin Test', 'AdminPass-123');
doc_put('admins', 'adm1', array('uid' => 'adm1', 'email' => 'admin@test.local', 'role' => 'admin', 'active' => true));
// membre actif migré (ancien mot de passe SHA-512)
mkuser('legacy-m1', 'ancien@test.local', 'Ancien Membre', 'OldPass!2021', true);
doc_put('membres', 'legacy-m1', array('nom' => 'Ancien Membre', 'email' => 'ancien@test.local', 'telephone' => '+229000', 'pays' => 'Bénin', 'secteur' => 'Coaching',
    'statut' => 'actif', 'role' => 'membre', 'publicProfileEnabled' => true, 'createdAt' => $ts($now - 86400000)));
doc_put('annuaire', 'legacy-m1', array('nom' => 'Ancien Membre', 'secteur' => 'Coaching', 'pays' => 'Bénin', 'bio' => 'x', 'createdAt' => $ts($now - 86400000)));
// membre en attente
mkuser('pend1', 'attente@test.local', 'Membre Attente', 'PendPass-123');
doc_put('membres', 'pend1', array('nom' => 'Membre Attente', 'email' => 'attente@test.local', 'statut' => 'en_attente', 'role' => 'membre', 'createdAt' => $ts($now - 3600000)));
// articles : 3 publiés (dates différentes) et 1 brouillon
doc_put('actualites', 'a1', array('titre' => 'Article ancien', 'publie' => true, 'publishedAt' => $ts($now - 3 * 86400000), 'authorUid' => 'adm1'));
doc_put('actualites', 'a2', array('titre' => 'Article milieu', 'publie' => true, 'publishedAt' => $ts($now - 2 * 86400000), 'authorUid' => 'adm1'));
doc_put('actualites', 'a3', array('titre' => 'Article récent', 'publie' => true, 'publishedAt' => $ts($now - 1 * 86400000), 'authorUid' => 'adm1'));
doc_put('actualites', 'a4', array('titre' => 'Brouillon secret', 'publie' => false, 'publishedAt' => $ts($now), 'authorUid' => 'adm1'));
doc_put('evenements', 'e1', array('titre' => 'Événement', 'publie' => true, 'date' => '2030-01-15'));
doc_put('partenaires', 'p1', array('nom' => 'Partenaire', 'createdAt' => $ts($now)));
echo "base de test prête (" . cfg('db_name') . ")\n";
