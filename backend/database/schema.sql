CREATE DATABASE IF NOT EXISTS management_paket_ramadhan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE management_paket_ramadhan;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL
);

CREATE TABLE package_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_days_total INT NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  image_path VARCHAR(255) NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL
);

CREATE TABLE resellers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NULL,
  address TEXT NULL,
  login_username VARCHAR(100) NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL
);

CREATE TABLE reseller_deposits (
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

CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reseller_id INT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NULL,
  address TEXT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  CONSTRAINT fk_customers_reseller FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE SET NULL
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  reseller_id INT NULL,
  order_date DATE NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_status ENUM('lunas','belum_lunas') NOT NULL DEFAULT 'belum_lunas',
  payment_days_total INT NOT NULL DEFAULT 0,
  payment_days_target INT NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_period VARCHAR(32) NULL,
  notes TEXT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_reseller FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE SET NULL
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

INSERT INTO users (username, password, created_at, updated_at)
VALUES ('admin', MD5('admin123'), NOW(), NOW());
