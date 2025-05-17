const User = require('../models/User');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;

// Xem profile người dùng
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.params.id;
    console.log('getProfile - userId:', userId);
    console.log('getProfile - session.user:', req.session.user);
    if (!mongoose.isValidObjectId(userId)) {
      console.log('getProfile - Invalid userId');
      return res.status(400).render('pages/error', {
        message: `Invalid user ID: ${userId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    const user = await User.findById(userId).select('-password -googleId').populate('friends', 'username avatar');
    console.log('getProfile - user:', user);
    if (!user) {
      console.log('getProfile - User not found');
      return res.status(404).render('pages/error', {
        message: `User not found for ID: ${userId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    const isFriend = req.session.user && user.friends.some(f => f._id.toString() === req.session.user._id);

    res.render('pages/profile', {
      profileUser: user,
      isFriend,
      currentUser: req.session.user,
      title: `${user.username}'s Profile`,
      layout: 'layouts/main'
    });
  } catch (err) {
    console.error('getProfile - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'An unexpected error occurred.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
};

// Form chỉnh sửa profile
exports.getEditProfile = (req, res) => {
  console.log('getEditProfile - session.user:', req.session.user);
  if (!req.session.user || !req.session.user._id) {
    console.log('getEditProfile - No session user');
    return res.redirect('/auth/login');
  }
  res.render('pages/edit-profile', {
    user: req.session.user,
    errors: [],
    csrfToken: res.locals.csrfToken,
    title: 'Edit Profile',
    layout: 'layouts/main'
  });
};

// Cập nhật profile
exports.updateProfile = async (req, res, next) => {
  try {
    console.log('updateProfile - session.user:', req.session.user);
    if (!req.session.user || !req.session.user._id) {
      console.log('updateProfile - No session user');
      return res.status(401).redirect('/auth/login');
    }

    const { username, email, bio } = req.body;
    const userId = req.session.user._id;
    console.log('updateProfile - userId:', userId, 'body:', req.body);
    console.log('updateProfile - file:', req.file);

    if (!mongoose.isValidObjectId(userId)) {
      console.log('updateProfile - Invalid userId');
      return res.status(400).render('pages/error', {
        message: `Invalid user ID in session: ${userId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    // Validate input
    const errors = [];
    if (!username || username.length < 3) {
      errors.push({ msg: 'Username must be at least 3 characters long' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ msg: 'Please enter a valid email' });
    }
    if (bio && bio.length > 500) {
      errors.push({ msg: 'Bio cannot exceed 500 characters' });
    }

    // Kiểm tra username hoặc email đã tồn tại
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
      _id: { $ne: userId }
    });
    if (existingUser) {
      if (existingUser.username === username) {
        errors.push({ msg: 'Username is already taken' });
      }
      if (existingUser.email === email) {
        errors.push({ msg: 'Email is already registered' });
      }
    }

    if (errors.length > 0) {
      console.log('updateProfile - Validation errors:', errors);
      if (req.file) {
        await fs.unlink(req.file.path).catch(err => console.error('updateProfile - Delete file error:', err));
      }
      return res.status(400).render('pages/edit-profile', {
        user: { ...req.session.user, username, email, bio },
        errors,
        csrfToken: res.locals.csrfToken,
        title: 'Edit Profile',
        layout: 'layouts/main'
      });
    }

    const updateData = { username, email, bio };

    if (req.file) {
      try {
        console.log('updateProfile - Uploading to Cloudinary:', req.file.path);
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'social-network/avatars',
          width: 200,
          height: 200,
          crop: 'fill',
          format: 'jpg'
        });
        console.log('updateProfile - Cloudinary result:', result);
        updateData.avatar = result.secure_url;
        await fs.unlink(req.file.path).catch(err => {
          console.error('updateProfile - Delete file error:', err);
        });
        console.log('updateProfile - Deleted local file:', req.file.path);
      } catch (uploadErr) {
        console.error('updateProfile - Cloudinary upload error:', uploadErr);
        await fs.unlink(req.file.path).catch(err => console.error('updateProfile - Delete file error:', err));
        errors.push({ msg: 'Failed to upload avatar. Please try again.' });
        return res.status(500).render('pages/edit-profile', {
          user: { ...req.session.user, username, email, bio },
          errors,
          csrfToken: res.locals.csrfToken,
          title: 'Edit Profile',
          layout: 'layouts/main'
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -googleId');

    console.log('updateProfile - updatedUser:', updatedUser);
    if (!updatedUser) {
      console.log('updateProfile - User not found');
      return res.status(404).render('pages/error', {
        message: `User not found for ID: ${userId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    req.session.user = updatedUser;

    res.redirect(`/users/profile/${userId}`);
  } catch (err) {
    console.error('updateProfile - Error:', err);
    if (req.file) {
      await fs.unlink(req.file.path).catch(err => console.error('updateProfile - Delete file error:', err));
    }
    res.status(500).render('pages/edit-profile', {
      user: req.session.user,
      errors: [{ msg: err.message || 'An unexpected error occurred.' }],
      csrfToken: res.locals.csrfToken,
      title: 'Edit Profile',
      layout: 'layouts/main'
    });
  }
};

// Tìm kiếm người dùng
exports.searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;
    console.log('searchUsers - query:', query);
    if (!query) {
      return res.render('pages/search', {
        users: [],
        query: '',
        title: 'Search Users',
        currentUser: req.session.user,
        layout: 'layouts/main'
      });
    }

    const users = await User.find({
      username: { $regex: query, $options: 'i' }
    }).select('username email avatar _id');
    console.log('searchUsers - users:', users);

    res.render('pages/search', {
      users,
      query,
      title: 'Search Users',
      currentUser: req.session.user,
      layout: 'layouts/main'
    });
  } catch (err) {
    console.error('searchUsers - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'An unexpected error occurred.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
};

// Xem danh sách bạn bè
exports.getFriends = async (req, res, next) => {
  try {
    console.log('getFriends - session.user:', req.session.user);
    if (!req.session.user || !req.session.user._id) {
      console.log('getFriends - No session user');
      return res.redirect('/auth/login');
    }

    const userId = req.session.user._id;
    console.log('getFriends - userId:', userId);
    if (!mongoose.isValidObjectId(userId)) {
      console.log('getFriends - Invalid userId');
      return res.status(400).render('pages/error', {
        message: `Invalid user ID in session: ${userId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    const user = await User.findById(userId).populate('friends', 'username avatar');
    console.log('getFriends - user:', user);
    if (!user) {
      console.log('getFriends - User not found');
      return res.status(404).render('pages/error', {
        message: `User not found for ID: ${userId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    res.render('pages/friends', {
      friends: user.friends,
      currentUser: req.session.user,
      title: 'Friends',
      layout: 'layouts/main'
    });
  } catch (err) {
    console.error('getFriends - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'An unexpected error occurred.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
};

// Thêm/bỏ bạn bè
exports.toggleFriend = async (req, res, next) => {
  try {
    console.log('toggleFriend - session.user:', req.session.user);
    if (!req.session.user || !req.session.user._id) {
      console.log('toggleFriend - No session user');
      return res.status(401).redirect('/auth/login');
    }

    const friendId = req.params.id;
    const userId = req.session.user._id;
    console.log('toggleFriend - userId:', userId, 'friendId:', friendId);

    if (!mongoose.isValidObjectId(friendId)) {
      console.log('toggleFriend - Invalid friendId');
      return res.status(400).render('pages/error', {
        message: `Invalid friend ID: ${friendId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    if (!mongoose.isValidObjectId(userId)) {
      console.log('toggleFriend - Invalid userId');
      return res.status(400).render('pages/error', {
        message: `Invalid user ID in session: ${userId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);
    console.log('toggleFriend - user:', user, 'friend:', friend);

    if (!user) {
      console.log('toggleFriend - User not found');
      return res.status(404).render('pages/error', {
        message: `User not found for ID: ${userId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    if (!friend) {
      console.log('toggleFriend - Friend not found');
      return res.status(404).render('pages/error', {
        message: `Friend not found for ID: ${friendId}`,
        user: req.session.user,
        layout: 'layouts/main'
      });
    }

    const isFriend = user.friends.includes(friendId);

    if (isFriend) {
      user.friends.pull(friendId);
      friend.friends.pull(userId);
    } else {
      user.friends.push(friendId);
      friend.friends.push(userId);
    }

    await user.save();
    await friend.save();

    res.redirect(`/users/profile/${friendId}`);
  } catch (err) {
    console.error('toggleFriend - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'An unexpected error occurred.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
};