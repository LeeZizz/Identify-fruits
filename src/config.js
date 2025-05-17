const path = require('path');

module.exports = {
  DB_CONFIG: {
    host: 'localhost', // Hoặc IP của MySQL server
    user: 'root',      // Username của bạn
    password: 'root',  // Password của bạn, ví dụ: 'your_mysql_password'
    database: 'fruit_recognition_db' // Tên database
  },
  DATASET_DIR: path.join(__dirname, '..', 'public', 'assets', 'fruits_data'),
  PUBLIC_DIR: path.join(__dirname, '..', 'public'),
  UPLOAD_DIR: path.join(__dirname, '..', 'public', 'uploads') // Thư mục lưu ảnh upload
};
