const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('./config');

const pool = mysql.createPool(DB_CONFIG);

async function initializeDatabase() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Connected to MySQL database.');

    // Tạo database nếu chưa tồn tại (lưu ý quyền của user MySQL)
    // Trong môi trường production, bạn có thể muốn tạo DB thủ công
    // await connection.query(`CREATE DATABASE IF NOT EXISTS ${DB_CONFIG.database}`);
    // await connection.query(`USE ${DB_CONFIG.database}`);
    // console.log(`Database ${DB_CONFIG.database} is ready.`);

    // Tạo bảng images nếu chưa tồn tại
    const createImagesTableQuery = `
      CREATE TABLE IF NOT EXISTS images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        filepath VARCHAR(512) NOT NULL UNIQUE, -- Đường dẫn tương đối từ public_dir
        features JSON, -- Lưu trữ vector đặc trưng dưới dạng JSON
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await connection.query(createImagesTableQuery);
    console.log('Table \'images\' is ready.');

    // Tạo bảng query_logs nếu chưa tồn tại
    const createQueryLogsTableQuery = `
      CREATE TABLE IF NOT EXISTS query_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_image_path VARCHAR(512),
        query_features JSON,
        result_image_ids JSON, -- Lưu ID của các ảnh kết quả dưới dạng JSON array
        similarity_scores JSON, -- Lưu điểm tương đồng tương ứng
        queried_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await connection.query(createQueryLogsTableQuery);
    console.log('Table \'query_logs\' is ready.');

  } catch (error) {
    console.error('Error initializing database:', error);
    // throw error; // Ném lỗi để ứng dụng chính xử lý nếu cần
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Gọi hàm này khi khởi động ứng dụng nếu bạn muốn tự động tạo bảng
// initializeDatabase(); 
// Hoặc bạn có thể chạy nó một lần riêng biệt hoặc dùng file SQL

module.exports = { pool, initializeDatabase };
