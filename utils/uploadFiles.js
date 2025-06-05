const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `post_${Date.now()}_${file.originalname}`);
  }
});

const uploadFiles = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 50MB/file
    files: 10                   // Cho phép nhiều file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|mp4|mov|mp3|wav|pdf|docx|xlsx|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('File không hợp lệ'));
  }
}).array('files', 10);

module.exports = uploadFiles;
