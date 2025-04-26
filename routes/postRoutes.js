/*const express = require('express');
const postController = require('../controllers/postController');
const { isAuthenticated } = require('../middleware/auth');
const { upload } = require('../utils/upload');
const router = express.Router();

router.get('/', isAuthenticated, postController.getPosts);
router.post('/create', isAuthenticated, upload.single('image'), postController.createPost);
router.post('/:id/like', isAuthenticated, postController.likePost);

module.exports = router;
*/
// Trang chủ hiển thị bài đăng (placeholder)
const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const postController = require('../controllers/postController');
const router = express.Router();

// Trang chủ hiển thị bài đăng
router.get('/home', isAuthenticated, postController.getHome);
/*
// Trang chủ hiển thị bài đăng
router.get('/home', isAuthenticated, (req, res, next) => {
    console.log('Route /home called');
    postController.getHome(req, res, next);
  });
*/
// Tạo bài đăng
router.post('/create', isAuthenticated, postController.createPost);

module.exports = router;