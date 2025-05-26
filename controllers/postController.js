const Post = require('../models/Post');
const Comment = require('../models/Comment');
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
      .sort({ createdAt: -1 })
      .lean();

    for (let post of posts) {
      post.comments = await Comment.find({ post: post._id })
        .populate('author', 'username avatar')
        .sort({ createdAt: -1 })
        .lean();
    }

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
        posts: await Post.find().populate('author', 'username avatar').sort({ createdAt: -1 }).lean(),
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
          posts: await Post.find().populate('author', 'username avatar').sort({ createdAt: -1 }).lean(),
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
        posts: await Post.find().populate('author', 'username avatar').sort({ createdAt: -1 }).lean(),
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

    const post = await Post.findById(postId).populate('author', 'username avatar').lean();
    if (!post) {
      console.log('getPost - Post not found');
      return res.status(404).render('pages/error', {
        message: `Post not found for ID: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    post.comments = await Comment.find({ post: postId })
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 })
      .lean();

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
    console.log('likePost - body:', req.body);
    if (!req.session.user || !req.session.user._id) {
      console.log('likePost - No session user');
      return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }

    const postId = req.params.id;
    console.log('likePost - postId:', postId);
    if (!mongoose.isValidObjectId(postId)) {
      console.log('likePost - Invalid postId');
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const userId = req.session.user._id;
    const post = await Post.findById(postId);
    if (!post) {
      console.log('likePost - Post not found');
      return res.status(404).json({ error: 'Post not found' });
    }

    const hasLiked = post.likes.some(id => id.toString() === userId.toString());
    let updatedPost;

    if (hasLiked) {
      updatedPost = await Post.findOneAndUpdate(
        { _id: postId },
        { $pull: { likes: userId } },
        { new: true }
      );
    } else {
      updatedPost = await Post.findOneAndUpdate(
        { _id: postId },
        { $addToSet: { likes: userId } },
        { new: true }
      );
    }

    console.log('likePost - updated post:', updatedPost);
    res.json({ likes: updatedPost.likes.length, liked: !hasLiked });
  } catch (err) {
    console.error('likePost - Error:', err);
    res.status(500).json({ error: err.message || 'An unexpected error occurred.' });
  }
};

// Xóa bài đăng
exports.deletePost = async (req, res, next) => {
  try {
    if (!req.session.user || !req.session.user._id) {
      return res.redirect('/auth/login');
    }

    const postId = req.params.id;
    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).render('pages/error', {
        message: `ID bài đăng không hợp lệ: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main',
        title: 'Lỗi'
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).render('pages/error', {
        message: `Không tìm thấy bài đăng với ID: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main',
        title: 'Lỗi'
      });
    }

    // Kiểm tra quyền xóa (chỉ tác giả hoặc admin)
    if (post.author.toString() !== req.session.user._id && req.session.user.role !== 'admin') {
      return res.status(403).render('pages/error', {
        message: 'Bạn không có quyền xóa bài đăng này.',
        user: req.session.user,
        layout: 'layouts/main',
        title: 'Lỗi'
      });
    }

    // Xóa media trên Cloudinary nếu có
    if (post.media && post.media.url) {
      const publicId = post.media.url.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`social-network/posts/${publicId}`, {
        resource_type: post.media.type === 'image' ? 'image' : post.media.type === 'video' ? 'video' : 'raw'
      });
    }

    // Xóa các bình luận liên quan
    await Comment.deleteMany({ post: postId });

    // Xóa bài đăng
    await Post.findByIdAndDelete(postId);

    res.redirect('/home');
  } catch (err) {
    res.status(500).render('pages/error', {
      message: err.message || 'Đã xảy ra lỗi khi xóa bài đăng.',
      user: req.session.user,
      layout: 'layouts/main',
      title: 'Lỗi'
    });
  }
};

// Lấy thông tin bài đăng để chỉnh sửa
exports.getEditPost = async (req, res, next) => {
  try {
    if (!req.session.user || !req.session.user._id) {
      return res.redirect('/auth/login');
    }

    const postId = req.params.id;
    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).render('pages/error', {
        message: `ID bài đăng không hợp lệ: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main',
        title: 'Lỗi'
      });
    }

    const post = await Post.findById(postId).populate('author', 'username avatar').lean();
    if (!post) {
      return res.status(404).render('pages/error', {
        message: `Không tìm thấy bài đăng với ID: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main',
        title: 'Lỗi'
      });
    }

    // Kiểm tra quyền chỉnh sửa (chỉ tác giả)
    if (post.author._id.toString() !== req.session.user._id) {
      return res.status(403).render('pages/error', {
        message: 'Bạn không có quyền chỉnh sửa bài đăng này.',
        user: req.session.user,
        layout: 'layouts/main',
        title: 'Lỗi'
      });
    }

    res.render('pages/edit-post', {
      post,
      user: req.session.user,
      csrfToken: req.csrfToken(),
      errors: [],
      title: 'Chỉnh sửa bài đăng',
      layout: 'layouts/main'
    });
  } catch (err) {
    res.status(500).render('pages/error', {
      message: err.message || 'Đã xảy ra lỗi khi tải bài đăng.',
      user: req.session.user,
      layout: 'layouts/main',
      title: 'Lỗi'
    });
  }
};

// Cập nhật bài đăng
exports.updatePost = async (req, res, next) => {
  try {
    if (!req.session.user || !req.session.user._id) {
      return res.redirect('/auth/login');
    }

    const postId = req.params.id;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).render('pages/error', {
        message: `ID bài đăng không hợp lệ: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main',
        title: 'Lỗi'
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).render('pages/error', {
        message: `Không tìm thấy bài đăng với ID: ${postId}`,
        user: req.session.user,
        layout: 'layouts/main',
        title: 'Lỗi'
      });
    }

    // Kiểm tra quyền chỉnh sửa (chỉ tác giả)
    if (post.author.toString() !== req.session.user._id) {
      return res.status(403).render('pages/error', {
        message: 'Bạn không có quyền chỉnh sửa bài đăng này.',
        user: req.session.user,
        layout: 'layouts/main',
        title: 'Lỗi'
      });
    }

    // Validate input
    const errors = [];
    if (!content || content.length > 1000) {
      errors.push({ msg: 'Nội dung phải từ 1 đến 1000 ký tự.' });
    }

    if (req.file) {
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
      } else {
        await fs.unlink(req.file.path);
        errors.push({ msg: 'Chỉ chấp nhận file JPEG, PNG, MP4, MOV, MP3, WAV.' });
      }

      if (errors.length === 0) {
        // Xóa media cũ trên Cloudinary nếu có
        if (post.media && post.media.url) {
          const publicId = post.media.url.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`social-network/posts/${publicId}`, {
            resource_type: post.media.type === 'image' ? 'image' : post.media.type === 'video' ? 'video' : 'raw'
          });
        }

        // Upload media mới
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'social-network/posts',
          resource_type: resource_type,
          public_id: `post_${Date.now()}_${path.basename(req.file.originalname, ext)}`
        });
        post.media = {
          url: result.secure_url,
          type: mediaType
        };
        await fs.unlink(req.file.path);
      }
    }

    if (errors.length > 0) {
      return res.status(400).render('pages/edit-post', {
        post: { _id: postId, content, media: post.media },
        errors,
        user: req.session.user,
        csrfToken: req.csrfToken(),
        title: 'Chỉnh sửa bài đăng',
        layout: 'layouts/main'
      });
    }

    // Cập nhật bài đăng
    post.content = content;
    await post.save();

    res.redirect('/home');
  } catch (err) {
    if (req.file) {
      await fs.unlink(req.file.path);
    }
    res.status(500).render('pages/error', {
      message: err.message || 'Đã xảy ra lỗi khi cập nhật bài đăng.',
      user: req.session.user,
      layout: 'layouts/main',
      title: 'Lỗi'
    });
  }
};
