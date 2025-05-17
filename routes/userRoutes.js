const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../utils/upload');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

// Xem profile
router.get('/profile/:id', userController.getProfile);

// Cập nhật profile
router.get('/edit', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
}, userController.getEditProfile);
router.post('/edit', upload, (req, res, next) => {
  console.log('After Multer - req.body:', req.body);
  console.log('After Multer - req.file:', req.file);
  if (!req.body._csrf) {
    console.error('Missing CSRF token in req.body');
    return res.status(403).render('pages/edit-profile', {
      user: req.session.user,
      errors: [{ msg: 'Missing CSRF token. Please refresh the page.' }],
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: 'Edit Profile',
      layout: 'layouts/main'
    });
  }
  next();
}, csrfProtection, userController.updateProfile);

// Tìm kiếm người dùng
router.get('/search', userController.searchUsers);

// Xem danh sách bạn bè
router.get('/friends', userController.getFriends);

// Thêm/bỏ bạn bè
router.post('/friend/:id', csrfProtection, userController.toggleFriend);

module.exports = router;