const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../utils/upload');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

// Xem profile
router.get('/profile/:id', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
}, userController.getProfile);

// Cập nhật profile
router.get('/edit', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
}, userController.getEditProfile);
router.post('/edit', upload, csrfProtection, userController.updateProfile);

// Tìm kiếm người dùng
router.get('/search', userController.searchUsers);

// Xem danh sách bạn bè
router.get('/friends', userController.getFriends);

// Thêm/bỏ bạn bè
router.post('/friend/:id', csrfProtection, userController.toggleFriend);

module.exports = router;