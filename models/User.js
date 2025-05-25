const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Chỉ dùng cho đăng nhập thường
  googleId: { type: String }, // Dùng cho Google OAuth
  avatar: { type: String }, // URL từ Cloudinary
  bio: { type: String },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Tạo index cho tìm kiếm nhanh
userSchema.index({ username: 1, email: 1 });

module.exports = mongoose.model('User', userSchema);