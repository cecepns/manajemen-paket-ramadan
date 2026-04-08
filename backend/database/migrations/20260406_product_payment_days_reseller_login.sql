-- products: jumlah hari bayar default per paket (cicilan)
SET @has_prod_pdt := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'payment_days_total'
);

SET @sql_prod_pdt := IF(
  @has_prod_pdt = 0,
  "ALTER TABLE products ADD COLUMN payment_days_total INT NOT NULL DEFAULT 0 AFTER price",
  "SELECT 'products.payment_days_total already exists' AS message"
);
PREPARE stmt_prod_pdt FROM @sql_prod_pdt;
EXECUTE stmt_prod_pdt;
DEALLOCATE PREPARE stmt_prod_pdt;

-- orders: target hari bayar (SUM qty * product.payment_days_total saat simpan)
SET @has_ord_pdt := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'payment_days_target'
);

SET @sql_ord_pdt := IF(
  @has_ord_pdt = 0,
  "ALTER TABLE orders ADD COLUMN payment_days_target INT NOT NULL DEFAULT 0 AFTER payment_days_total",
  "SELECT 'orders.payment_days_target already exists' AS message"
);
PREPARE stmt_ord_pdt FROM @sql_ord_pdt;
EXECUTE stmt_ord_pdt;
DEALLOCATE PREPARE stmt_ord_pdt;

-- resellers: login mandiri
SET @has_r_login := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resellers'
    AND COLUMN_NAME = 'login_username'
);

SET @sql_r_login := IF(
  @has_r_login = 0,
  "ALTER TABLE resellers ADD COLUMN login_username VARCHAR(100) NULL UNIQUE AFTER address",
  "SELECT 'resellers.login_username already exists' AS message"
);
PREPARE stmt_r_login FROM @sql_r_login;
EXECUTE stmt_r_login;
DEALLOCATE PREPARE stmt_r_login;

SET @has_r_pass := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resellers'
    AND COLUMN_NAME = 'password_hash'
);

SET @sql_r_pass := IF(
  @has_r_pass = 0,
  "ALTER TABLE resellers ADD COLUMN password_hash VARCHAR(255) NULL AFTER login_username",
  "SELECT 'resellers.password_hash already exists' AS message"
);
PREPARE stmt_r_pass FROM @sql_r_pass;
EXECUTE stmt_r_pass;
DEALLOCATE PREPARE stmt_r_pass;

-- Backfill payment_days_target dari order_items + products
UPDATE orders o
SET payment_days_target = COALESCE((
  SELECT SUM(oi.qty * COALESCE(p.payment_days_total, 0))
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE oi.order_id = o.id
), 0);
