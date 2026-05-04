-- Jalankan setelah schema.sql + migrasi PHP yang ada.
-- Fitur: alamat pelanggan, periode pembayaran order, kategori paket, setoran reseller.

USE management_paket_ramadhan;

-- Alamat anggota/pelanggan
SET @c_addr := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'address'
);
SET @sql_c := IF(@c_addr = 0,
  'ALTER TABLE customers ADD COLUMN address TEXT NULL AFTER phone',
  'SELECT 1');
PREPARE s FROM @sql_c; EXECUTE s; DEALLOCATE PREPARE s;

-- Periode pembayaran (order)
SET @o_pp := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'payment_period'
);
SET @sql_o := IF(@o_pp = 0,
  "ALTER TABLE orders ADD COLUMN payment_period VARCHAR(32) NULL AFTER amount_paid",
  'SELECT 1');
PREPARE s FROM @sql_o; EXECUTE s; DEALLOCATE PREPARE s;

-- Kategori paket
CREATE TABLE IF NOT EXISTS package_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL
);

SET @p_cat := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'category_id'
);
SET @sql_p := IF(@p_cat = 0,
  'ALTER TABLE products ADD COLUMN category_id INT NULL AFTER id',
  'SELECT 1');
PREPARE s FROM @sql_p; EXECUTE s; DEALLOCATE PREPARE s;

-- Setoran reseller ke owner
CREATE TABLE IF NOT EXISTS reseller_deposits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reseller_id INT NOT NULL,
  deposit_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_method ENUM('cash','transfer') NOT NULL DEFAULT 'cash',
  proof_image_path VARCHAR(255) NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  CONSTRAINT fk_deposits_reseller FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE CASCADE
);

CREATE INDEX idx_deposits_reseller_date ON reseller_deposits (reseller_id, deposit_date);

-- Order lama: tandai legacy (pengali 1 = sama dengan rumus lama harga×qty).
UPDATE orders SET payment_period = 'legacy' WHERE payment_period IS NULL OR payment_period = '';
