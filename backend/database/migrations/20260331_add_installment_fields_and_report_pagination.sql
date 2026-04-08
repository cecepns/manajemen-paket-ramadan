SET @has_payment_days_total := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'payment_days_total'
);

SET @sql_payment_days := IF(
  @has_payment_days_total = 0,
  "ALTER TABLE orders ADD COLUMN payment_days_total INT NOT NULL DEFAULT 0 AFTER payment_status",
  "SELECT 'payment_days_total already exists' AS message"
);
PREPARE stmt_payment_days FROM @sql_payment_days;
EXECUTE stmt_payment_days;
DEALLOCATE PREPARE stmt_payment_days;

SET @has_amount_paid := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'amount_paid'
);

SET @sql_amount_paid := IF(
  @has_amount_paid = 0,
  "ALTER TABLE orders ADD COLUMN amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER payment_days_total",
  "SELECT 'amount_paid already exists' AS message"
);
PREPARE stmt_amount_paid FROM @sql_amount_paid;
EXECUTE stmt_amount_paid;
DEALLOCATE PREPARE stmt_amount_paid;

UPDATE orders
SET amount_paid = CASE
  WHEN payment_status = 'lunas' THEN total_amount
  ELSE amount_paid
END,
payment_days_total = COALESCE(payment_days_total, 0);
