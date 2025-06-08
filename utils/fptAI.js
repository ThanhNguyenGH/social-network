const multer = require('multer');
const s3 = require('../config/backblaze');

const uploadFiles = multer({
  storage: multer.memoryStorage(), // Lưu file vào bộ nhớ tạm thời trước khi upload lên B2
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB/file
    files: 10 // Cho phép tối đa 10 file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|mp4|mov|mp3|wav|pdf|docx|xlsx|zip|rar/;
    const extname = allowedTypes.test(file.originalname.toLowerCase().split('.').pop());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('File không hợp lệ'));
  }
}).array('files', 10);

module.exports = uploadFiles;