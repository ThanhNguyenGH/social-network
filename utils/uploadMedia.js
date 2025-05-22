const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `post_${Date.now()}_${file.originalname}`);
  }
});

const uploadMedia = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
    fields: 20,
    parts: 20
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|mp4|mov|mp3|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (JPEG, PNG), videos (MP4, MOV), and audio (MP3, WAV) are allowed'));
  }
}).single('media');

module.exports = uploadMedia;