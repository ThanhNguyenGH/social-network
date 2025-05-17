const Post = require('../models/Post');
const mongoose = require('mongoose');

exports.getHome = async (req, res, next) => {
  try {
    console.log('getHome - session.user:', req.session.user);
    if (!req.session.user || !req.session.user._id) {
      console.log('getHome - No session user');
      return res.redirect('/auth/login');
    }

    const posts = await Post.find()
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 });
    console.log('getHome - posts:', posts);

    res.render('pages/home', {
      posts,
      user: req.session.user,
      csrfToken: res.locals.csrfToken,
      title: 'Home',
      layout: 'layouts/main'
    });
  } catch (err) {
    console.error('getHome - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'An unexpected error occurred.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
};

exports.createPost = async (req, res, next) => {
  try {
    console.log('createPost - session.user:', req.session.user);
    if (!req.session.user || !req.session.user._id) {
      console.log('createPost - No session user');
      return res.status(401).redirect('/auth/login');
    }

    const { content } = req.body;
    console.log('createPost - content:', content);
    if (!content || content.length > 1000) {
      return res.status(400).render('pages/home', {
        posts: await Post.find().populate('author', 'username avatar').sort({ createdAt: -1 }),
        user: req.session.user,
        csrfToken: res.locals.csrfToken,
        errors: [{ msg: 'Content must be between 1 and 1000 characters' }],
        title: 'Home',
        layout: 'layouts/main'
      });
    }

    const post = new Post({
      content,
      author: req.session.user._id
    });
    await post.save();
    console.log('createPost - post:', post);

    res.redirect('/home');
  } catch (err) {
    console.error('createPost - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'An unexpected error occurred.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    console.log('getPost - postId:', postId);
    if (!mongoose.isValidObjectId(postId)) {
      console.log('getPost - Invalid postId');
      return res.status(400).render('pages/error', {
        message: `Invalid post ID: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    const post = await Post.findById(postId).populate('author', 'username avatar');
    console.log('getPost - post:', post);
    if (!post) {
      console.log('getPost - Post not found');
      return res.status(404).render('pages/error', {
        message: `Post not found for ID: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    res.render('pages/post', {
      post,
      user: req.session.user,
      title: 'Post',
      layout: 'layouts/main'
    });
  } catch (err) {
    console.error('getPost - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'An unexpected error occurred.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
};

exports.likePost = async (req, res, next) => {
  try {
    console.log('likePost - session.user:', req.session.user);
    if (!req.session.user || !req.session.user._id) {
      console.log('likePost - No session user');
      return res.status(401).redirect('/auth/login');
    }

    const postId = req.params.id;
    console.log('likePost - postId:', postId);
    if (!mongoose.isValidObjectId(postId)) {
      console.log('likePost - Invalid postId');
      return res.status(400).render('pages/error', {
        message: `Invalid post ID: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    const post = await Post.findById(postId);
    console.log('likePost - post:', post);
    if (!post) {
      console.log('likePost - Post not found');
      return res.status(404).render('pages/error', {
        message: `Post not found for ID: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    const userId = req.session.user._id;
    const hasLiked = post.likes.includes(userId);

    if (hasLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    console.log('likePost - updated post:', post);

    res.redirect(`/post/${postId}`);
  } catch (err) {
    console.error('likePost - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'An unexpected error occurred.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
};