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
  'mail_mode'=> 'mail',               // 'mail' (fonction PHP mail() d'OVH) ou 'log' (écrit dans api/mail.log, pour les tests)
  'cookie_secure' => true,            // false uniquement en test local (http)
);
