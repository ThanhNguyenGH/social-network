const express = require('express');
const passport = require('passport');
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

const router = express.Router();

// GET /auth/register
router.get('/register', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
}, (req, res) => {
  res.render('pages/register', {
    errors: [],
    csrfToken: res.locals.csrfToken,
    layout: false
  });
});

// POST /auth/register
router.post('/register', csrfProtection, [
  check('username').notEmpty().withMessage('Tên người dùng là bắt buộc').isLength({ min: 3 }).withMessage('Tên người dùng phải có ít nhất 3 ký tự'),
  check('email').isEmail().withMessage('Email không hợp lệ'),
  check('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự')
], authController.register);

// GET /auth/login
router.get('/login', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
}, (req, res) => {
  const successMessage = req.session.successMessage;
  delete req.session.successMessage;
  res.render('pages/login', {
    errors: [],
    successMessage,
    csrfToken: res.locals.csrfToken,
    layout: false
  });
});

// POST /auth/login
router.post('/login', csrfProtection, [
  check('email').isEmail().withMessage('Email không hợp lệ'),
  check('password').notEmpty().withMessage('Mật khẩu là bắt buộc')
], authController.login);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/auth/login' }), (req, res) => {
  if (!req.user) {
    return res.status(400).render('pages/login', {
      errors: [{ msg: 'Đăng nhập bằng Google thất bại' }],
      successMessage,
      csrfToken: res.locals.csrfToken,
      layout: false
    });
  }
  req.session.user = {
    _id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role,
    avatar: req.user.avatar
  };
  console.log('Google callback - session.user:', req.session.user); // Log để debug
  if (req.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/home');
});

// GET /auth/logout
router.get('/logout', authController.logout);

module.exports = router;