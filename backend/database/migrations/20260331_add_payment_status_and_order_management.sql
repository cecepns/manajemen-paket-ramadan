SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'payment_status'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE orders ADD COLUMN payment_status ENUM('lunas','belum_lunas') NOT NULL DEFAULT 'belum_lunas' AFTER total_amount",
  "SELECT 'payment_status already exists' AS message"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE orders
SET payment_status = 'belum_lunas'
WHERE payment_status IS NULL OR payment_status = '';
