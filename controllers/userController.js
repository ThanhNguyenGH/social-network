const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const redisClient = require('../config/redis');
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
          crop: 'fill'
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
    if (err instanceof multer.MulterError) {
      return res.status(400).render('pages/edit-profile', {
        user: req.session.user,
        errors: [{ msg: `Multer error: ${err.message}` }],
        csrfToken: res.locals.csrfToken,
        title: 'Edit Profile',
        layout: 'layouts/main'
      });
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
    if (!req.session.user || !req.session.user._id) {
      return res.redirect('/auth/login');
    }

    const query = req.query.query ? req.query.query.trim() : '';
    let users = [];
    let posts = [];

    // Luôn lấy tất cả người dùng
    users = await User.find().select('username email avatar').lean();

    // Nếu có query, lọc người dùng và bài đăng
    if (query) {
      users = await User.find({
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      }).select('username email avatar').lean();

      posts = await Post.find({
        content: { $regex: query, $options: 'i' }
      })
        .populate('author', 'username avatar')
        .sort({ createdAt: -1 })
        .lean();
    }

    // Lấy danh sách bạn bè
    const user = await User.findById(req.session.user._id).populate('friends', 'username avatar').lean();
    const friends = user.friends || [];

    res.render('pages/search', {
      users,
      posts,
      query,
      friends,
      user: req.session.user,
      currentUser: req.session.user,
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: `Kết quả tìm kiếm: ${query || 'Tất cả'}`,
      layout: 'layouts/main'
    });
  } catch (err) {
    res.status(500).render('pages/error', {
      message: err.message || 'Đã xảy ra lỗi khi tìm kiếm.',
      user: req.session.user,
      currentUser: req.session.user,
      layout: 'layouts/main',
      title: 'Lỗi'
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

// Middleware kiểm tra quyền admin
exports.isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    console.log('isAdmin - Access denied:', req.session.user);
    return res.status(403).render('pages/error', {
      message: 'Bạn không có quyền truy cập trang quản trị.',
      user: req.session.user,
      layout: 'layouts/admin'
    });
  }
  next();
};

// Trang dashboard admin
exports.getAdminDashboard = async (req, res, next) => {
  try {
    console.log('getAdminDashboard - session.user:', req.session.user);
    // Lấy một số thông tin thống kê cơ bản (tùy chọn)
    const totalUsers = await User.countDocuments();
    res.render('admin/dashboard', {
      currentUser: req.session.user,
      totalUsers,
      title: 'Bảng điều khiển quản trị',
      layout: 'layouts/admin'
    });
  } catch (err) {
    console.error('getAdminDashboard - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'Đã xảy ra lỗi khi tải bảng điều khiển.',
      user: req.session.user,
      layout: 'layouts/admin'
    });
  }
};

// Lấy danh sách tất cả người dùng
exports.getAllUsers = async (req, res, next) => {
  try {
    console.log('getAllUsers - session.user:', req.session.user);
    const users = await User.find().select('username email role createdAt');
    res.render('admin/users', {
      users,
      currentUser: req.session.user, // Truyền currentUser
      title: 'Quản lý người dùng',
      layout: 'layouts/admin',
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    console.error('getAllUsers - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'Đã xảy ra lỗi khi tải danh sách người dùng.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
};
// Form tạo người dùng mới (admin)
exports.getCreateUser = (req, res) => {
  console.log('getCreateUser - session.user:', req.session.user);
  res.render('admin/edit-user', {
    user: null,
    errors: [],
    csrfToken: res.locals.csrfToken,
    title: 'Tạo người dùng mới',
    layout: 'layouts/admin'
  });
};

// Lấy thông tin người dùng để chỉnh sửa
exports.getEditUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    console.log('getEditUser - userId:', userId);
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).render('pages/error', {
        message: 'ID người dùng không hợp lệ.',
        user: req.session.user,
        layout: 'layouts/admin'
      });
    }
    const user = await User.findById(userId).select('username email role bio isBanned banReason');
    if (!user) {
      return res.status(404).render('pages/error', {
        message: 'Không tìm thấy người dùng.',
        user: req.session.user,
        layout: 'layouts/admin'
      });
    }
    res.render('admin/edit-user', {
      user,
      currentUser: req.session.user,
      title: 'Chỉnh sửa người dùng',
      layout: 'layouts/admin',
      csrfToken: res.locals.csrfToken,
      errors: []
    });
  } catch (err) {
    console.error('getEditUser - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'Đã xảy ra lỗi khi tải thông tin người dùng.',
      user: req.session.user,
      layout: 'layouts/admin'
    });
  }
};

// Cập nhật người dùng (admin)
exports.updateUser = async (req, res, next) => {
  try {
    console.log('updateUser - session.user:', req.session.user);
    const userId = req.params.id;
    const { username, email, role, bio, isBanned, banReason } = req.body;
    console.log('updateUser - userId:', userId, 'body:', req.body);

    if (!mongoose.isValidObjectId(userId)) {
      console.log('updateUser - Invalid userId');
      return res.status(400).render('pages/error', {
        message: `ID người dùng không hợp lệ: ${userId}`,
        user: req.session.user,
        layout: 'layouts/admin'
      });
    }

    // Validate input
    const errors = [];
    if (!username || username.length < 3) {
      errors.push({ msg: 'Tên người dùng phải có ít nhất 3 ký tự.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ msg: 'Vui lòng nhập email hợp lệ.' });
    }
    if (!['user', 'admin'].includes(role)) {
      errors.push({ msg: 'Vai trò không hợp lệ.' });
    }
    if (bio && bio.length > 500) {
      errors.push({ msg: 'Tiểu sử không được vượt quá 500 ký tự.' });
    }
    if (isBanned === 'on' && !banReason) {
      errors.push({ msg: 'Vui lòng chọn lý do cấm.' });
    }

    // Kiểm tra username hoặc email đã tồn tại
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
      _id: { $ne: userId }
    });
    if (existingUser) {
      if (existingUser.username === username) {
        errors.push({ msg: 'Tên người dùng đã được sử dụng.' });
      }
      if (existingUser.email === email) {
        errors.push({ msg: 'Email đã được đăng ký.' });
      }
    }

    if (errors.length > 0) {
      console.log('updateUser - Validation errors:', errors);
      return res.status(400).render('admin/edit-user', {
        user: { _id: userId, username, email, role, bio, isBanned: isBanned === 'on', banReason },
        errors,
        currentUser: req.session.user,
        csrfToken: res.locals.csrfToken,
        title: 'Chỉnh sửa người dùng',
        layout: 'layouts/admin'
      });
    }

    const updateData = {
      username,
      email,
      role,
      bio,
      isBanned: isBanned === 'on',
      banReason: isBanned === 'on' ? banReason : null
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('username email role avatar bio isBanned banReason');

    console.log('updateUser - updatedUser:', updatedUser);
    if (!updatedUser) {
      console.log('updateUser - User not found');
      return res.status(404).render('pages/error', {
        message: `Không tìm thấy người dùng với ID: ${userId}`,
        user: req.session.user,
        layout: 'layouts/admin'
      });
    }

    res.redirect('/admin/users');
  } catch (err) {
    console.error('updateUser - Error:', err);
    res.status(500).render('admin/edit-user', {
      user: { _id: userId, username, email, role, bio, isBanned: isBanned === 'on', banReason },
      errors: [{ msg: err.message || 'Đã xảy ra lỗi khi cập nhật người dùng.' }],
      currentUser: req.session.user,
      csrfToken: res.locals.csrfToken,
      title: 'Chỉnh sửa người dùng',
      layout: 'layouts/admin'
    });
  }
};

// Xóa người dùng (admin)
exports.deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    console.log('deleteUser - userId:', userId);
    if (!mongoose.isValidObjectId(userId)) {
      console.log('deleteUser - Invalid userId');
      return res.status(400).render('pages/error', {
        message: `ID người dùng không hợp lệ: ${userId}`,
        user: req.session.user,
        layout: 'layouts/admin'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log('deleteUser - User not found');
      return res.status(404).render('pages/error', {
        message: `Không tìm thấy người dùng với ID: ${userId}`,
        user: req.session.user,
        layout: 'layouts/admin'
      });
    }

    // Xóa các bài đăng của người dùng
    await Post.deleteMany({ user: userId });

    // Xóa các bình luận của người dùng
    await Comment.deleteMany({ user: userId });

    // Xóa người dùng khỏi danh sách bạn bè của người khác
    await User.updateMany(
      { friends: userId },
      { $pull: { friends: userId } }
    );

    // Xóa người dùng
    await User.findByIdAndDelete(userId);

    // Tìm và xóa session Redis của user này
    const keys = await redisClient.keys('sess:*');
    for (const key of keys) {
      const sessionStr = await redisClient.get(key);
      if (sessionStr) {
        const sessionObj = JSON.parse(sessionStr);
        if (sessionObj?.user?._id === userId) {
          await redisClient.del(key);
          console.log(`[Redis] Deleted session for user ${userId}: ${key}`);
        }
      }
    }

    console.log('deleteUser - Deleted user and related data:', userId);
    res.redirect('/admin/users');
  } catch (err) {
    console.error('deleteUser - Error:', err);
    res.status(500).render('pages/error', {
      message: err.message || 'Đã xảy ra lỗi khi xóa người dùng.',
      user: req.session.user,
      layout: 'layouts/admin'
    });
  }
};
