-- Schéma de la base de l'API GREC (compatible MySQL 5.6 / MariaDB : pas de JSON, pas de fonctions récentes).
-- Les tables de l'ancien site (g_*) ne sont JAMAIS touchées. Toutes les tables de l'API commencent par app_.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS app_user (
  uid            VARCHAR(64)  NOT NULL,
  email          VARCHAR(190) NOT NULL,
  pass_hash      VARCHAR(255) NULL,
  pass_sha512    CHAR(128)    NULL,
  display_name   VARCHAR(255) NOT NULL DEFAULT '',
  photo_url      VARCHAR(500) NOT NULL DEFAULT '',
  email_verified TINYINT(1)   NOT NULL DEFAULT 0,
  disabled       TINYINT(1)   NOT NULL DEFAULT 0,
  created_ms     BIGINT       NOT NULL,
  last_login_ms  BIGINT       NULL,
  PRIMARY KEY (uid),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_doc (
  coll       VARCHAR(120) NOT NULL,
  id         VARCHAR(120) NOT NULL,
  data       MEDIUMTEXT   NOT NULL,
  k1         VARCHAR(190) NULL,
  k2         VARCHAR(190) NULL,
  ord        BIGINT       NULL,
  updated_ms BIGINT       NOT NULL,
  PRIMARY KEY (coll, id),
  KEY ix_k1  (coll, k1),
  KEY ix_k2  (coll, k2),
  KEY ix_ord (coll, ord)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_reset (
  token_hash CHAR(64)    NOT NULL,
  uid        VARCHAR(64) NOT NULL,
  expires_ms BIGINT      NOT NULL,
  used       TINYINT(1)  NOT NULL DEFAULT 0,
  kind       VARCHAR(20) NOT NULL DEFAULT 'reset',
  PRIMARY KEY (token_hash),
  KEY ix_uid (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_attempt (
  k      VARCHAR(190) NOT NULL,
  ts_ms  BIGINT       NOT NULL,
  KEY ix_k (k, ts_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
