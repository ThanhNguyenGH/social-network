const Post = require('../models/Post');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;
const path = require('path');

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
      errors: [],
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
      if (req.file) {
        await fs.unlink(req.file.path).catch(err => console.error('createPost - Delete file error:', err));
      }
      return res.status(400).render('pages/home', {
        posts: await Post.find().populate('author', 'username avatar').sort({ createdAt: -1 }),
        user: req.session.user,
        csrfToken: res.locals.csrfToken,
        errors: [{ msg: 'Content must be between 1 and 1000 characters' }],
        title: 'Home',
        layout: 'layouts/main'
      });
    }

    const postData = {
      content,
      author: req.session.user._id
    };

    // Xử lý media nếu có file upload
    if (req.file) {
      console.log('createPost - file:', req.file);
      try {
        const ext = path.extname(req.file.originalname).toLowerCase();
        let mediaType = '';
        let resource_type = 'auto';
        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
          mediaType = 'image';
          resource_type = 'image';
        } else if (['.mp4', '.mov'].includes(ext)) {
          mediaType = 'video';
          resource_type = 'video';
        } else if (['.mp3', '.wav'].includes(ext)) {
          mediaType = 'audio';
          resource_type = 'raw';
        }

        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'social-network/posts',
          resource_type: resource_type,
          public_id: `post_${Date.now()}_${path.basename(req.file.originalname, ext)}`
        });
        console.log('createPost - Cloudinary result:', result);
        postData.media = {
          url: result.secure_url,
          type: mediaType
        };
        await fs.unlink(req.file.path).catch(err => {
          console.error('createPost - Delete file error:', err);
        });
        console.log('createPost - Deleted local file:', req.file.path);
      } catch (uploadErr) {
        console.error('createPost - Cloudinary upload error:', uploadErr);
        await fs.unlink(req.file.path).catch(err => console.error('createPost - Delete file error:', err));
        return res.status(400).render('pages/home', {
          posts: await Post.find().populate('author', 'username avatar').sort({ createdAt: -1 }),
          user: req.session.user,
          csrfToken: res.locals.csrfToken,
          errors: [{ msg: 'Failed to upload media. Please try again.' }],
          title: 'Home',
          layout: 'layouts/main'
        });
      }
    }

    const post = new Post(postData);
    await post.save();
    console.log('createPost - post:', post);

    res.redirect('/home');
  } catch (err) {
    console.error('createPost - Error:', err);
    if (req.file) {
      await fs.unlink(req.file.path).catch(err => console.error('createPost - Delete file error:', err));
    }
    if (err instanceof mongoose.Error || err instanceof multer.MulterError) {
      return res.status(400).render('pages/home', {
        posts: await Post.find().populate('author', 'username avatar').sort({ createdAt: -1 }),
        user: req.session.user,
        csrfToken: res.locals.csrfToken,
        errors: [{ msg: err.message }],
        title: 'Home',
        layout: 'layouts/main'
      });
    }
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