<?php
// Envoi d'images vers l'hébergement (dossier uploads/ à la racine du site), à la place de Cloudinary.
// Chaque image est vérifiée (vrai format image), redimensionnée et ré-encodée : un fichier déguisé n'est jamais conservé tel quel.

function upload_dir()
{
    $d = cfg('upload_dir');
    return $d ? rtrim($d, '/\\') : dirname(__DIR__, 2) . '/uploads';
}

// Garde-fou Apache : dans uploads/, rien ne s'exécute et seuls des fichiers image sont servis.
function upload_protect($dir)
{
    $f = $dir . '/.htaccess';
    if (is_file($f)) return;
    @file_put_contents($f, "Options -Indexes -ExecCGI\nRemoveHandler .php .phtml .php3 .php4 .php5 .php7 .phar\n"
        . "<FilesMatch \"\\.(?i:php[0-9]?|phtml|phar|pl|py|cgi|sh|html?|js)\$\">\n  Require all denied\n</FilesMatch>\n");
}

function upload_resize($src, $type, $max)
{
    if (!function_exists('imagecreatetruecolor')) return null;
    $loaders = array(IMAGETYPE_JPEG => 'imagecreatefromjpeg', IMAGETYPE_PNG => 'imagecreatefrompng', IMAGETYPE_WEBP => 'imagecreatefromwebp');
    if (!isset($loaders[$type]) || !function_exists($loaders[$type])) return null;
    $img = @$loaders[$type]($src);
    if (!$img) return null;
    $w = imagesx($img);
    $h = imagesy($img);
    if ($w > $max || $h > $max) {
        $r = min($max / $w, $max / $h);
        $nw = max(1, (int) round($w * $r));
        $nh = max(1, (int) round($h * $r));
        $dst = imagecreatetruecolor($nw, $nh);
        if ($type !== IMAGETYPE_JPEG) {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
        }
        imagecopyresampled($dst, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imagedestroy($img);
        $img = $dst;
    } elseif ($type !== IMAGETYPE_JPEG) {
        imagealphablending($img, false);
        imagesavealpha($img, true);
    }
    return $img;
}

// Enregistre une image après vérification ; retourne le chemin relatif (ex. "membres/ab12cd34.jpg").
// $quiet : au lieu de répondre une erreur HTTP, retourne null (utilisé par l'outil de migration).
function upload_store($tmp, $folder, $quiet = false)
{
    $info = @getimagesize($tmp);
    $types = array(IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp');
    if (!$info || !isset($types[$info[2]])) { if ($quiet) return null; fail(415, 'bad-image', 'Fichier image invalide (JPEG, PNG, WebP ou GIF).'); }
    $type = $info[2];
    $ext = $types[$type];
    $dir = upload_dir() . '/' . $folder;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) { if ($quiet) return null; fail(500, 'upload-failed', 'Dossier de destination indisponible.'); }
    upload_protect(upload_dir());
    $name = bin2hex(random_bytes(10)) . '.' . $ext;
    $dest = $dir . '/' . $name;
    $img = $type === IMAGETYPE_GIF ? null : upload_resize($tmp, $type, 1600);
    if ($img) {
        if ($type === IMAGETYPE_JPEG) $ok = imagejpeg($img, $dest, 85);
        elseif ($type === IMAGETYPE_PNG) $ok = imagepng($img, $dest, 6);
        else $ok = imagewebp($img, $dest, 85);
        imagedestroy($img);
        if (!$ok) { if ($quiet) return null; fail(500, 'upload-failed', 'Enregistrement impossible.'); }
    } else {
        if ($info[0] > 4000 || $info[1] > 4000) { if ($quiet) return null; fail(413, 'too-large', 'Image trop grande (4000 px maximum).'); }
        if (!@copy($tmp, $dest)) { if ($quiet) return null; fail(500, 'upload-failed', 'Enregistrement impossible.'); }
    }
    @chmod($dest, 0644);
    return $folder . '/' . $name;
}

function handle_upload()
{
    session_boot();
    require_csrf();
    $uid = current_uid();
    if (!$uid) fail(401, 'auth/requires-login', 'Connexion requise');
    if (attempts_exceeded('upload:' . $uid, 60, 60)) fail(429, 'resource-exhausted', 'Trop d\'envois, réessayez plus tard.');
    $f = isset($_FILES['file']) ? $_FILES['file'] : null;
    if (!$f || !is_uploaded_file($f['tmp_name'])) {
        $big = $f && in_array($f['error'], array(UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE), true);
        fail($big ? 413 : 400, $big ? 'too-large' : 'bad-request', $big ? 'Image trop volumineuse.' : 'Aucun fichier reçu.');
    }
    if ($f['size'] > 10 * 1024 * 1024) fail(413, 'too-large', 'Image trop volumineuse (10 Mo maximum).');
    $folder = isset($_POST['folder']) ? strtolower(trim((string) $_POST['folder'], " /\t")) : '';
    $folder = strtok($folder, '/');
    if (!in_array($folder, array('membres', 'actualites', 'evenements', 'contributions', 'galerie', 'partenaires'), true)) $folder = 'divers';
    record_attempt('upload:' . $uid);
    $rel = upload_store($f['tmp_name'], $folder);
    json_out(200, array('url' => rtrim(cfg('site_url'), '/') . '/uploads/' . $rel));
}
