const express = require('express');
const passport = require('passport');
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const router = express.Router();

router.get('/register', (req, res) => {
  res.render('pages/register', {
    errors: [],
    csrfToken: req.csrfToken(),
    layout: 'layouts/main'
  });
});

router.post('/register', [
  check('username').notEmpty().withMessage('Username is required').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  check('email').isEmail().withMessage('Invalid email'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], authController.register);

router.get('/login', (req, res) => {
  res.render('pages/login', {
    errors: [],
    csrfToken: req.csrfToken(),
    layout: 'layouts/main'
  });
});

router.post('/login', [
  check('email').isEmail().withMessage('Invalid email'),
  check('password').notEmpty().withMessage('Password is required')
], authController.login);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/auth/login' }), (req, res) => {
  req.session.user = req.user;
  res.redirect('/home');
});

router.get('/logout', authController.logout);

module.exports = router;