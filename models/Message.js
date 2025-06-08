const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, default: '' },
  files: [
    {
      url: { type: String, required: true },
      key: { type: String, required: true }, // Lưu key để gia hạn URL
      name: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      expiresAt: { type: Date, required: true } // Thời gian hết hạn của signed URL
    }
  ],
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ sender: 1, receiver: 1, isRead: 1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ 'files.expiresAt': 1 }); // Index để tìm file sắp hết hạn

module.exports = mongoose.model('Message', messageSchema);