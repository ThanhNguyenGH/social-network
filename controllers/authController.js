const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('pages/register', {
      errors: errors.array(),
      csrfToken: req.csrfToken(),
      layout: 'layouts/main'
    });
  }

  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).render('pages/register', {
        errors: [{ msg: 'Username or email already exists' }],
        csrfToken: req.csrfToken(),
        layout: 'layouts/main'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    req.session.user = user;
    res.redirect('/home');
  } catch (err) {
    console.error(err);
    res.status(500).render('pages/error', {
      error: 'Server error',
      csrfToken: req.csrfToken(),
      layout: 'layouts/main'
    });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('pages/login', {
      errors: errors.array(),
      csrfToken: req.csrfToken(),
      layout: 'layouts/main'
    });
  }

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).render('pages/login', {
        errors: [{ msg: 'Invalid email or password' }],
        csrfToken: req.csrfToken(),
        layout: 'layouts/main'
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    req.session.user = user;
    res.redirect('/home');
  } catch (err) {
    console.error(err);
    res.status(500).render('pages/error', {
      error: 'Server error',
      csrfToken: req.csrfToken(),
      layout: 'layouts/main'
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).render('pages/error', {
        error: 'Failed to logout',
        csrfToken: req.csrfToken(),
        layout: 'layouts/main'
      });
    }
    res.redirect('/auth/login');
  });
};