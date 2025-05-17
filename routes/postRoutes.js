const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

router.get('/home', csrfProtection, postController.getHome);
router.post('/post', csrfProtection, postController.createPost);
router.get('/post/:id', postController.getPost);
router.post('/post/:id/like', csrfProtection, postController.likePost);

module.exports = router;