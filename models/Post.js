const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  media: {
    url: { type: String },       // URL từ Cloudinary
    type: { type: String }       // 'image' | 'video' | 'audio'
  },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

// Tạo index cho sắp xếp bài đăng
postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);