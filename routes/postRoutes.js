const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });
const uploadMedia = require('../utils/uploadMedia');

router.get('/home', csrfProtection, postController.getHome);
router.post('/posts/create', uploadMedia, csrfProtection, postController.createPost);
router.get('/post/:id', postController.getPost);
router.post('/post/:id/like', csrfProtection, postController.likePost);

module.exports = router;