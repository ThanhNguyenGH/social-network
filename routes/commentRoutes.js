const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const csurf = require('csurf');

const csrfProtection = csurf({ cookie: false });

router.post('/create', csrfProtection, commentController.createComment);
router.get('/:postId', commentController.getComments);
router.put('/:id/edit', csrfProtection, commentController.editComment);
router.delete('/:id/delete', csrfProtection, commentController.deleteComment);

module.exports = router;