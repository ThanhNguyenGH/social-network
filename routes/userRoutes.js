const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Trang hồ sơ (placeholder)
router.get('/profile', isAuthenticated, (req, res) => {
  res.render('pages/profile', { user: req.session.user, csrfToken: req.csrfToken() });
});

module.exports = router;