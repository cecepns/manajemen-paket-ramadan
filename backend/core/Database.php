<?php

class Database
{
    private static ?PDO $conn = null;

    public static function connection(): PDO
    {
        if (self::$conn !== null) {
            return self::$conn;
        }

        $env = require __DIR__ . '/../config/env.php';
        $dsn = "mysql:host={$env['db_host']};dbname={$env['db_name']};charset=utf8mb4";
        self::$conn = new PDO($dsn, $env['db_user'], $env['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return self::$conn;
    }
}
