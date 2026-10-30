<?php
// Copier ce fichier en config.php (jamais commité : il contient des identifiants) et renseigner les valeurs.
return array(
  'db_host'  => 'localhost',          // OVH : hconsuqgrec.mysql.db
  'db_name'  => 'grec',               // OVH : hconsuqgrec
  'db_user'  => 'root',
  'db_pass'  => '',
  'secret'   => 'changer-cette-valeur-par-une-longue-chaine-aleatoire',
  'site_url' => 'https://grec.group', // utilisé dans les liens des e-mails
  'mail_from'=> 'GREC <no-reply@grec.group>',
  'mail_mode'=> 'smtp',               // 'smtp' (recommandé : boîte e-mail du domaine), 'mail' (fonction PHP mail()) ou 'log' (api/mail.log, tests)
  'smtp_host'=> 'ssl0.ovh.net',       // serveur SMTP OVH
  'smtp_port'=> 465,
  'smtp_secure'=> 'ssl',              // 'ssl' (port 465), 'tls' (STARTTLS, port 587) ou 'none' (tests)
  'smtp_user'=> 'no-reply@grec.group', // boîte e-mail réelle créée chez OVH
  'smtp_pass'=> '',
  'legacy_mirror' => false,           // true : reflète les membres dans l'ancienne table g_membre (vrai site uniquement, pas sur le serveur de test)
  'cookie_secure' => true,            // false uniquement en test local (http)
);
