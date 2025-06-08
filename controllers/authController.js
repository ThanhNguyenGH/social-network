const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('pages/register', {
      errors: errors.array(),
      username: req.body.username,
      email: req.body.email,
      csrfToken: req.csrfToken(),
      layout: false 
    });
  }

  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).render('pages/register', {
        errors: [{ msg: 'Tên người dùng hoặc email đã tồn tại' }],
        username: req.body.username,
        email: req.body.email,
        csrfToken: req.csrfToken(),
        layout: false
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword });

    req.session.successMessage = 'Đăng ký thành công!';
    return res.redirect('/auth/login');

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).render('pages/error', {
      message: 'Đã xảy ra lỗi khi đăng ký.',
      username: req.body.username,
      email: req.body.email,
      csrfToken: req.csrfToken(),
      layout: 'layouts/main'
    });
  }
};


exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('pages/login', {
      successMessage: null,
      errors: errors.array(),
      email: req.body.email,
      csrfToken: req.csrfToken(),
      layout: false 
    });
  }

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).render('pages/login', {
        successMessage: null,
        errors: [{ msg: 'Email hoặc mật khẩu không đúng' }],
        email: req.body.email,
        csrfToken: req.csrfToken(),
        layout: false
      });
    }
    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).render('pages/login', {
        successMessage: null,
        errors: [{ msg: 'Email hoặc mật khẩu không đúng' }],
        email: req.body.email,
        csrfToken: req.csrfToken(),
        layout: false
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar
    };
    console.log('Login - session.user:', req.session.user); 

    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/home');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('pages/error', {
      message: 'Đã xảy ra lỗi khi đăng nhập.',
      csrfToken: req.csrfToken(),
      layout: 'layouts/main'
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).render('pages/error', {
        message: 'Đã xảy ra lỗi khi đăng xuất.',
        csrfToken: req.csrfToken(),
        layout: 'layouts/main'
      });
    }
    res.redirect('/auth/login');
  });
};