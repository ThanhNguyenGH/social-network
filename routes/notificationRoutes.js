const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Trang chat (placeholder)
router.get('/', isAuthenticated, (req, res) => {
  res.render('pages/chat', { user: req.session.user, csrfToken: req.csrfToken() });
});

module.exports = router;