<?php
// Routeur du serveur de test local (php -S) : /api/* -> API ; le reste = fichiers statiques du site.
$p = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
if (strpos($p, '/api/') === 0) { require dirname(__DIR__) . '/index.php'; return true; }
return false;
