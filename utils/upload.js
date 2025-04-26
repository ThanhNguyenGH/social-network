const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'social-network',
    allowed_formats: ['jpg', 'png']
  }
});

const upload = multer({ storage });

const uploadImage = async (file) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream((error, result) => {
      if (error) reject(error);
      else resolve(result.secure_url);
    }).end(file.buffer);
  });
};

module.exports = { upload, uploadImage };