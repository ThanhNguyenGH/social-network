const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Placeholder cho bình luận
router.post('/:postId', isAuthenticated, (req, res) => {
  res.redirect('/home');
});

module.exports = router;