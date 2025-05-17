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
    layout: 'layouts/main'
  });
});

// POST /auth/register
router.post('/register', csrfProtection, [
  check('username').notEmpty().withMessage('Username is required').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  check('email').isEmail().withMessage('Invalid email'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], authController.register);

// GET /auth/login
router.get('/login', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
}, (req, res) => {
  res.render('pages/login', {
    errors: [],
    csrfToken: res.locals.csrfToken,
    layout: 'layouts/main'
  });
});

// POST /auth/login
router.post('/login', csrfProtection, [
  check('email').isEmail().withMessage('Invalid email'),
  check('password').notEmpty().withMessage('Password is required')
], authController.login);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/auth/login' }), (req, res) => {
  req.session.user = req.user;
  res.redirect('/home');
});

// GET /auth/logout
router.get('/logout', authController.logout);

module.exports = router;