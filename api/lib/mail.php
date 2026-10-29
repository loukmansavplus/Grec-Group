<?php
// Envoi d'e-mails : fonction mail() de l'hébergement OVH (comme l'ancien site), ou journal local pour les tests.

function send_mail($to, $subject, $html)
{
    $from = cfg('mail_from') ?: 'GREC <no-reply@grec.group>';
    if (cfg('mail_mode') === 'log') {
        $line = '[' . date('c') . "] TO: $to | SUBJECT: $subject\n$html\n-----\n";
        @file_put_contents(dirname(__DIR__) . '/mail.log', $line, FILE_APPEND);
        return true;
    }
    $fromAddr = preg_match('/<([^>]+)>/', $from, $m) ? $m[1] : $from;
    $headers = "From: $from\r\nReply-To: $fromAddr\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nX-Mailer: GREC";
    $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    return @mail($to, $subj, $html, $headers, '-f' . $fromAddr);
}

function mail_template($title, $intro, $buttonLabel, $url)
{
    $site = htmlspecialchars(cfg('site_url') ?: '', ENT_QUOTES, 'UTF-8');
    $u = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
    $t = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $i = htmlspecialchars($intro, ENT_QUOTES, 'UTF-8');
    $b = htmlspecialchars($buttonLabel, ENT_QUOTES, 'UTF-8');
    return '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0D1B2A">'
        . '<h2 style="color:#0D1B2A;margin:0 0 16px">' . $t . '</h2>'
        . '<p style="line-height:1.6">' . $i . '</p>'
        . '<p style="margin:24px 0"><a href="' . $u . '" style="background:#C8893A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">' . $b . '</a></p>'
        . '<p style="color:#64748b;font-size:13px">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>' . $u . '</p>'
        . '<p style="color:#94a3b8;font-size:12px;margin-top:28px">GREC — Groupe de Réflexion sur l\'Entrepreneuriat et la Créativité au Bénin · ' . $site . '</p></div>';
}
