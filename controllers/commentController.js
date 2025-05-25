const Comment = require('../models/Comment');
const Post = require('../models/Post');
const mongoose = require('mongoose');
const { broadcastComment } = require('../server');

exports.createComment = async (req, res, next) => {
  try {
    const user = req.session.user;
    if (!user || !user._id) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để gửi bình luận.' });
    }

    const now = Date.now();
    const lastCommentTime = req.session.lastCommentTime || 0;
    if (now - lastCommentTime < 5000) {
      return res.status(429).json({ error: 'Vui lòng đợi vài giây trước khi gửi bình luận tiếp theo.' });
    }

    const { content, postId } = req.body;
    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({ error: 'ID bài đăng không hợp lệ.' });
    }

    if (!content || content.length > 500) {
      return res.status(400).json({ error: 'Bình luận phải từ 1 đến 500 ký tự.' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Không tìm thấy bài đăng.' });
    }

    const comment = new Comment({
      content,
      author: user._id,
      post: postId
    });
    await comment.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'username avatar')
      .lean();

    req.session.lastCommentTime = now;
    broadcastComment(postId, populatedComment);

    res.json({ comment: populatedComment });
  } catch (err) {
    console.error('createComment - Error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi không mong muốn.' });
  }
};

exports.getComments = async (req, res, next) => {
  try {
    const postId = req.params.postId;
    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({ error: 'ID bài đăng không hợp lệ.' });
    }

    const comments = await Comment.find({ post: postId })
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ comments });
  } catch (err) {
    console.error('getComments - Error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi không mong muốn.' });
  }
};

exports.editComment = async (req, res, next) => {
  try {
    const user = req.session.user;
    if (!user || !user._id) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để sửa bình luận.' });
    }

    const commentId = req.params.id;
    if (!mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ error: 'ID bình luận không hợp lệ.' });
    }

    const { content } = req.body;
    if (!content || content.length > 500) {
      return res.status(400).json({ error: 'Bình luận phải từ 1 đến 500 ký tự.' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Không tìm thấy bình luận.' });
    }

    if (comment.author.toString() !== user._id) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa bình luận này.' });
    }

    // Kiểm tra thời gian sửa (5 phút)
    const createdAt = new Date(comment.createdAt);
    const now = new Date();
    if ((now - createdAt) > 5 * 60 * 1000) {
      return res.status(403).json({ error: 'Đã hết thời gian chỉnh sửa bình luận (5 phút sau khi đăng).' });
    }

    comment.content = content;
    comment.updatedAt = new Date();
    await comment.save();

    const populatedComment = await Comment.findById(commentId)
      .populate('author', 'username avatar')
      .lean();

    req.app.get('io').to(comment.post.toString()).emit('updatedComment', {
      postId: comment.post.toString(),
      comment: populatedComment
    });

    res.json({ comment: populatedComment });
  } catch (err) {
    console.error('editComment - Error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi không mong muốn.' });
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const user = req.session.user;
    if (!user || !user._id) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để xóa bình luận.' });
    }

    const commentId = req.params.id;
    if (!mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ error: 'ID bình luận không hợp lệ.' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Không tìm thấy bình luận.' });
    }

    if (comment.author.toString() !== user._id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bình luận này.' });
    }

    const postId = comment.post.toString();
    await Comment.deleteOne({ _id: commentId });

    req.app.get('io').to(postId).emit('deletedComment', {
      postId,
      commentId
    });

    res.json({ message: 'Xóa bình luận thành công.' });
  } catch (err) {
    console.error('deleteComment - Error:', err);
    res.status(500).json({ error: err.message || 'Đã xảy ra lỗi không mong muốn.' });
  }
};