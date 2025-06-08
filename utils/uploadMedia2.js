const multer = require('multer');
const path = require('path');

// Multer cho media (hình ảnh, video, âm thanh)
const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB/file
    files: 10 // Tối đa 10 file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|mp4|mov|mp3|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('File media không hợp lệ'));
  }
}).array('media', 10);


module.exports = uploadMedia;