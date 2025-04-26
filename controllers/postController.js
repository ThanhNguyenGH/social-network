const Post = require('../models/Post');

exports.getHome = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'username') // Lấy username của người đăng
      .sort({ createdAt: -1 }); // Sắp xếp theo thời gian mới nhất
    res.render('pages/home', {
      posts,
      csrfToken: req.csrfToken(),
      layout: 'layouts/main'
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('pages/error', {
      error: 'Failed to load home page',
      csrfToken: req.csrfToken(),
      layout: 'layouts/main'
    });
  }
};

exports.createPost = async (req, res) => {
  const { content } = req.body;
  try {
    await Post.create({
      user: req.session.user._id,
      content
    });
    res.redirect('/home');
  } catch (err) {
    console.error(err);
    res.status(500).render('pages/error', {
      error: 'Failed to create post',
      csrfToken: req.csrfToken(),
      layout: 'layouts/main'
    });
  }
};