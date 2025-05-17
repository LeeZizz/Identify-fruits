CREATE DATABASE IF NOT EXISTS fruit_recognition_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE fruit_recognition_db;

CREATE TABLE IF NOT EXISTS images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL, -- Đã sửa: bỏ chữ "images" thừa
  filepath VARCHAR(512) NOT NULL UNIQUE,
  features JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS query_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  query_image_path VARCHAR(512),
  query_features JSON,
  result_image_ids JSON, -- Đề xuất: đổi TEXT thành JSON cho nhất quán
  similarity_scores JSON, -- Đề xuất: đổi TEXT thành JSON cho nhất quán
  queried_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Add indexes for faster queries if needed, for example:
-- ALTER TABLE images ADD INDEX idx_fruit_type (fruit_type);

-- You can verify the tables with:
-- SHOW TABLES;
-- DESCRIBE images;
-- DESCRIBE query_logs;
