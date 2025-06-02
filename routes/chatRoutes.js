const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');


router.get('/',  chatController.getChatPage);
router.get('/messages/:userId',  chatController.getMessagesWithUser);
router.post('/send',  chatController.sendMessage);
router.post('/mark-read',  chatController.markAsRead);
router.get('/unread-count' , chatController.getUnreadCount);

module.exports = router;