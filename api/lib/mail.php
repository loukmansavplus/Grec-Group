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
    if (cfg('mail_mode') === 'mail_old') { // même méthode que l'ancien site PHP (essai de livraison)
        $h = "From: grec 
Reply-to: noreply@grec.group 
MIME-Version: 1.0 
Content-Type: text/html; charset=\"UTF-8\" 
";
        $ok = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $html, $h);
        @file_put_contents(dirname(__DIR__) . '/mail-send.log', '[' . date('c') . '] TO: ' . $to . ' | méthode ancien site : ' . ($ok ? 'accepté par le serveur' : 'REFUSÉ') . "
", FILE_APPEND);
        return $ok;
    }
    if (cfg('mail_mode') === 'smtp') {
        try {
            $ok = smtp_send($to, $subject, $html, $from, $fromAddr);
            $why = 'envoyé par SMTP';
        } catch (Exception $e) {
            $ok = false; $why = 'ÉCHEC SMTP : ' . $e->getMessage();
        }
        @file_put_contents(dirname(__DIR__) . '/mail-send.log', '[' . date('c') . '] TO: ' . $to . ' | ' . $why . "
", FILE_APPEND);
        return $ok;
    }
    $headers = "From: $from\r\nReply-To: $fromAddr\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nX-Mailer: GREC";
    $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $ok = @mail($to, $subj, $html, $headers, '-f' . $fromAddr);
    if (!$ok) $ok = @mail($to, $subj, $html, $headers); // certains hébergements refusent le paramètre d'expéditeur
    // résultat noté sans le contenu du message (diagnostic de livraison)
    @file_put_contents(dirname(__DIR__) . '/mail-send.log', '[' . date('c') . '] TO: ' . $to . ' | ' . ($ok ? 'accepté par le serveur' : 'REFUSÉ par le serveur') . "
", FILE_APPEND);
    return $ok;
}


// Envoi authentifié par SMTP (boîte e-mail du domaine) : les messages sont signés par le serveur de messagerie, bien mieux acceptés que mail().
function smtp_read($fp)
{
    $out = ''; $code = 0;
    while (($line = fgets($fp, 1024)) !== false) {
        $out .= $line;
        $code = (int) substr($line, 0, 3);
        if (strlen($line) < 4 || $line[3] !== '-') break;
    }
    return array($code, trim($out));
}

function smtp_cmd($fp, $cmd, $expect)
{
    if ($cmd !== null) fwrite($fp, $cmd . "\r\n");
    list($code, $text) = smtp_read($fp);
    if (!in_array($code, (array) $expect, true)) throw new Exception('SMTP ' . $code . ' ' . substr(preg_replace('/\s+/', ' ', $text), 0, 160));
    return $text;
}

function smtp_send($to, $subject, $html, $from, $fromAddr)
{
    $host = cfg('smtp_host'); $port = (int) (cfg('smtp_port') ?: 465); $secure = cfg('smtp_secure') ?: 'ssl';
    $user = cfg('smtp_user'); $pass = cfg('smtp_pass');
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 15);
    if (!$fp) throw new Exception('SMTP connexion impossible : ' . $errstr);
    stream_set_timeout($fp, 20);
    try {
        smtp_cmd($fp, null, 220);
        smtp_cmd($fp, 'EHLO grec.group', 250);
        if ($secure === 'tls') {
            smtp_cmd($fp, 'STARTTLS', 220);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new Exception('SMTP STARTTLS refusé');
            smtp_cmd($fp, 'EHLO grec.group', 250);
        }
        if ($user !== null && $user !== '') {
            smtp_cmd($fp, 'AUTH LOGIN', 334);
            smtp_cmd($fp, base64_encode($user), 334);
            smtp_cmd($fp, base64_encode((string) $pass), 235);
        }
        $env = $user ? $user : $fromAddr;
        smtp_cmd($fp, 'MAIL FROM:<' . $env . '>', 250);
        smtp_cmd($fp, 'RCPT TO:<' . $to . '>', array(250, 251));
        smtp_cmd($fp, 'DATA', 354);
        $domain = substr(strrchr($fromAddr, '@'), 1) ?: 'grec.group';
        $msg = "From: $from\r\nTo: <$to>\r\nReply-To: $fromAddr\r\nSubject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\nDate: " . date('r')
            . "\r\nMessage-ID: <" . bin2hex(random_bytes(12)) . "@$domain>\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html), 76, "\r\n");
        fwrite($fp, $msg . "\r\n.\r\n");
        smtp_cmd($fp, null, 250);
        @fwrite($fp, "QUIT\r\n");
        fclose($fp);
        return true;
    } catch (Exception $e) {
        @fclose($fp);
        throw $e;
    }
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
