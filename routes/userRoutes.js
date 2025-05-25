const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../utils/upload');
const csrf = require('csurf');
const { isAdmin } = userController;

const csrfProtection = csrf({ cookie: false });

router.get('/profile/:id', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
}, userController.getProfile);
router.get('/edit', csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
}, userController.getEditProfile);
router.post('/edit', upload, csrfProtection, userController.updateProfile);
router.get('/search', userController.searchUsers);
router.get('/friends', userController.getFriends);
router.post('/friend/:id', csrfProtection, userController.toggleFriend);


module.exports = router;