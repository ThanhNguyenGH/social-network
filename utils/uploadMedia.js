const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: './Uploads/',
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
    // Định nghĩa các loại file hợp lệ
    const fileTypes = {
      image: {
        ext: ['.jpg', '.jpeg', '.png'],
        mime: ['image/jpeg', 'image/png']
      },
      video: {
        ext: ['.mp4', '.mov'],
        mime: ['video/mp4', 'video/quicktime']
      },
      audio: {
        ext: ['.mp3', '.wav'],
        mime: ['audio/mpeg', 'audio/mp3', 'audio/wav']
      }
    };

    // Lấy phần mở rộng và mimetype
    const extname = path.extname(file.originalname).toLowerCase();
    const mimetype = file.mimetype;

    // Kiểm tra xem file có thuộc loại hợp lệ nào không
    let isValid = false;
    for (const type in fileTypes) {
      if (
        fileTypes[type].ext.includes(extname) &&
        fileTypes[type].mime.includes(mimetype)
      ) {
        isValid = true;
        break;
      }
    }

    if (isValid) {
      return cb(null, true);
    }
    cb(new Error('Only images (JPEG, PNG), videos (MP4, MOV), and audio (MP3, WAV) are allowed'));
  }
}).single('media');

module.exports = uploadMedia;