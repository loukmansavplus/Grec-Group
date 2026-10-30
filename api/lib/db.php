<?php
// Accès base de données (PDO MySQL, utf8mb4).

function db()
{
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = 'mysql:host=' . cfg('db_host') . ';dbname=' . cfg('db_name') . ';charset=utf8mb4';
            $pdo = new PDO($dsn, cfg('db_user'), cfg('db_pass'), array(
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ));
            $pdo->exec("SET NAMES utf8mb4");
        } catch (Exception $e) {
            fail(500, 'db-unavailable', 'Base de données indisponible');
        }
    }
    return $pdo;
}

function q($sql, $params = array())
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}
