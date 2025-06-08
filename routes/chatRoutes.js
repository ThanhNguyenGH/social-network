const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const csrfProtection = require('csurf')({ cookie: false });
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
}).fields([
  { name: 'media', maxCount: 10 },
  { name: 'files', maxCount: 10 }
]);

// app.js hoặc routes/chat.js
router.post('/mark-as-read', async (req, res) => {
  const { messageIds } = req.body;
  // Validate messageIds, cập nhật trạng thái đã đọc
  res.json({ success: true });
});


router.get('/', csrfProtection, chatController.getChatPage);
router.get('/messages/:userId', csrfProtection, chatController.getMessagesWithUser);
router.post('/send', upload, csrfProtection, chatController.sendMessage);
router.get('/unread-count', csrfProtection, chatController.getUnreadCount);

module.exports = router;