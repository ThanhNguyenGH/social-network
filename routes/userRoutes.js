const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../utils/upload');

// Xem profile
router.get('/profile/:id', userController.getProfile);

// Cập nhật profile
router.get('/edit', userController.getEditProfile);
router.post('/edit', upload.single('avatar'), userController.updateProfile);

// Tìm kiếm người dùng
router.get('/search', userController.searchUsers);

// Xem danh sách bạn bè
router.get('/friends', userController.getFriends);

// Thêm/bỏ bạn bè
router.post('/friend/:id', userController.toggleFriend);

module.exports = router;