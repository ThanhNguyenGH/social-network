const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const { RedisStore } = require('connect-redis');
const redisClient = require('./config/redis');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csurf = require('csurf');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const multer = require('multer');
const uploadMedia = require('./utils/uploadMedia');
const { isAdmin, getAdminDashboard, getAllUsers, getEditUser, updateUser, deleteUser } = require('./controllers/userController');
const User = require('./models/User');
const Message = require('./models/Message');
const chatController = require('./controllers/chatController');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
require('dotenv').config();
require('./config/passport');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Tăng timeout server
server.setTimeout(60000);

// Lưu instance io vào app
app.set('io', io);

// Kết nối MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: [
        "'self'",
        "https://res.cloudinary.com",
        "https://social-network-files.s3.us-west-004.backblazeb2.com",
        "data:"
      ],
      mediaSrc: ["'self'", "https://res.cloudinary.com",
        "https://social-network-files.s3.us-west-004.backblazeb2.com"
      ],
      connectSrc: ["'self'", "ws://localhost:3000", "wss://your-domain.com"]
    }
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// EJS và Layout
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Session với Redis
const sessionMiddleware = session({
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:',
    ttl: 86400
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
});

app.use(sessionMiddleware);

// Áp dụng session middleware cho Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Log session Redis
app.use(async (req, res, next) => {
  if (req.session?.user) {
    try {
      const sessionId = req.sessionID;
      const sessionData = await redisClient.get(`sess:${sessionId}`);
      console.log(`[Redis session] sess:${sessionId} => ${sessionData ? 'Found' : 'Not found'}`);
    } catch (err) {
      console.error('[Redis session] Error:', err.message);
    }
  }
  next();
});

// CSRF setup
const csrfProtection = csurf({ cookie: false });

// Khởi tạo CSRF token cho các route GET cần render form
app.use((req, res, next) => {
  if (req.method === 'GET') {
    const csrfInstance = csurf({ cookie: false });
    csrfInstance(req, res, () => {
      res.locals.csrfToken = req.csrfToken();
      res.locals.user = req.user || req.session.user;
      next();
    });
  } else {
    res.locals.csrfToken = '';
    res.locals.user = req.user || req.session.user;
    next();
  }
});

// Log POST request sau khi parse
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('POST Request Headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    });
    console.log('POST Request Body:', req.body);
  }
  next();
});

// Xử lý lỗi CSRF
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF Error:', err);
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    console.log('CSRF Token Expected:', req.csrfToken ? req.csrfToken() : 'Not available');
    console.log('CSRF Token Received:', req.body ? req.body._csrf : 'Not available');
    return res.status(403).render('pages/error', {
      message: 'Invalid CSRF token. Please refresh the page and try again.',
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
  next(err);
});

// Xử lý lỗi Multer và uploadMedia
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer Error:', err);
    return res.status(400).render('pages/error', {
      message: `Multer error: ${err.message}`,
      user: req.session.user,
      layout: 'layouts/main'
    });
  }
  if (err.message === 'Only images (JPEG, PNG), videos (MP4, MOV), and audio (MP3, WAV) are allowed') {
    console.error('File Type Error:', err);
    return res.status(400).render('pages/home', {
      posts: [],
      user: req.session.user,
      csrfToken: res.locals.csrfToken,
      errors: [{ msg: err.message }],
      title: 'Home',
      layout: 'layouts/main'
    });
  }
  if (err.message === 'Only JPEG and PNG images are allowed') {
    console.error('File Type Error:', err);
    return res.status(400).render('pages/edit-profile', {
      user: req.session.user,
      errors: [{ msg: err.message }],
      csrfToken: res.locals.csrfToken,
      title: 'Edit Profile',
      layout: 'layouts/main'
    });
  }
  next(err);
});

app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
}));

// Chat
app.use(async (req, res, next) => {
  try {
    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  } catch (err) {
    res.locals.csrfToken = '';
  }

  const sessionUser = req.user || req.session.user || null;

  if (sessionUser && sessionUser._id) {
    const user = await User.findById(sessionUser._id).lean();

    // Nếu user không còn trong DB => XÓA SESSION
    if (!user) {
      console.log(`[Security] User ${sessionUser._id} đã bị xóa khỏi DB. Xóa session.`);
      req.session.destroy(err => {
        if (err) {
          console.error('[Session] Destroy error:', err);
        }
        if (req.accepts('html')) {
          return res.redirect('/auth/login');
        }
        return res.status(401).json({ message: 'Your account has been deleted. Please login again.' });
      });
      return;
    }

    res.locals.currentUser = user;
    res.locals.user = user;
    res.locals.friendId = null;
    res.locals.unreadMap = {};

    try {
      const fullUser = await User.findById(user._id)
        .populate('friends', 'username avatar')
        .lean();

      res.locals.friends = fullUser?.friends || [];

      const unreadCounts = await Message.aggregate([
        {
          $match: {
            receiver: new mongoose.Types.ObjectId(user._id),
            isRead: false
          }
        },
        {
          $group: {
            _id: '$sender',
            count: { $sum: 1 }
          }
        }
      ]);

      unreadCounts.forEach(item => {
        res.locals.unreadMap[item._id.toString()] = item.count;
      });
    } catch (err) {
      console.error('Error fetching friends or unread messages:', err.message);
    }
  } else {
    res.locals.user = null;
    res.locals.currentUser = null;
    console.log('[Session] No user session found');
  }

  next();
});

// Redis adapter setup
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  chatController.handleSocketConnection(io);
});

// Quản lý trạng thái online với Redis
io.on('connection', (socket) => {
  const session = socket.request.session;
  const userId = session?.user?._id;

  // Khi người dùng kết nối
  socket.on('user:connect', async ({ userId }) => {
    if (mongoose.isValidObjectId(userId)) {
      try {
        // Lưu trạng thái online vào Redis (tập hợp online:users)
        await redisClient.sAdd('online:users', userId);
        await redisClient.set(`online:${userId}`, socket.id, { EX: 60 }); // Lưu socketId, hết hạn sau 60s
        console.log(`User ${userId} is online`);

        // Gửi trạng thái online đến tất cả client
        io.emit('user:status', {
          userId,
          isOnline: true
        });

        // Join room theo userId
        socket.join(userId);
        console.log(`[Socket.IO] User ${userId} joined their own room`);
      } catch (err) {
        console.error('[Redis] Error setting online status:', err);
      }
    }
  });

  // Khi người dùng ngắt kết nối
  socket.on('disconnect', async () => {
    if (userId && mongoose.isValidObjectId(userId)) {
      try {
        // Xóa trạng thái online khỏi Redis
        await redisClient.sRem('online:users', userId);
        await redisClient.del(`online:${userId}`);
        console.log(`User ${userId} is offline`);

        // Gửi trạng thái offline đến tất cả client
        io.emit('user:status', {
          userId,
          isOnline: false
        });
      } catch (err) {
        console.error('[Redis] Error removing online status:', err);
      }
    }
  });

  // Logic bình luận
  socket.on('subscribe', (postId) => {
    if (mongoose.isValidObjectId(postId)) {
      socket.join(postId);
      console.log(`Socket ${socket.id} subscribed to post ${postId}`);
    } else {
      console.log(`Socket ${socket.id} tried to subscribe to invalid postId: ${postId}`);
    }
  });

  socket.on('unsubscribe', (postId) => {
    socket.leave(postId);
    console.log(`Socket ${socket.id} unsubscribed from post ${postId}`);
  });

  socket.on('user_typing', ({ userId, targetId, isTyping }) => {
    io.to(targetId).emit('user_typing', { userId, isTyping });
  });

  socket.on('mark_read', ({ senderId, receiverId, messageIds }) => {
    io.to(senderId).emit('messages_read', {
      readerId: receiverId,
      messageIds
    });
  });

  // Đọc tin nhắn - cập nhật trạng thái đã đọc
  socket.on('chat:read', async ({ senderId, receiverId }) => {
    try {
      const unreadMessages = await Message.find({
        sender: senderId,
        receiver: receiverId,
        isRead: false
      }).select('_id');

      const messageIds = unreadMessages.map(msg => msg._id.toString());

      if (messageIds.length === 0) return;

      const result = await Message.updateMany(
        { _id: { $in: messageIds } },
        { $set: { isRead: true } }
      );

      console.log(`[Socket] ${receiverId} đã đọc ${result.modifiedCount} tin nhắn của ${senderId}`);

      io.to(senderId).emit('messages_read', {
        readBy: receiverId,
        senderId,
        messageIds
      });
    } catch (err) {
      console.error('[Socket] chat:read error:', err);
    }
  });
});

// API lấy danh sách user online
app.get('/users/online', async (req, res) => {
  try {
    if (!req.session.user || !req.session.user._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const onlineUserIds = await redisClient.sMembers('online:users');
    res.json({ success: true, onlineUsers: onlineUserIds });
  } catch (err) {
    console.error('[Redis] Error fetching online users:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

function broadcastComment(postId, comment) {
  io.to(postId).emit('newComment', { postId, comment });
}
module.exports.broadcastComment = broadcastComment;

// Gắn io vào request để sử dụng trong routes
app.use((req, res, next) => {
  req.io = app.get('io');
  next();
});

// Routes
app.get('/', (req, res) => {
  if (req.session.user || req.isAuthenticated()) {
    if (req.session.user && req.session.user.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else {
      res.redirect('/home');
    }
  } else {
    res.redirect('/auth/login');
  }
});

// Admin routes
app.get('/admin/dashboard', isAdmin, csrfProtection, getAdminDashboard);
app.get('/admin/users', isAdmin, csrfProtection, getAllUsers);
app.get('/admin/users/edit/:id', isAdmin, csrfProtection, getEditUser);
app.post('/admin/users/edit/:id', isAdmin, csrfProtection, updateUser);
app.post('/admin/users/delete/:id', isAdmin, csrfProtection, deleteUser);

app.use('/auth', require('./routes/authRoutes'));
app.use('/users', require('./routes/userRoutes'));
app.use(require('./routes/postRoutes'));
app.use('/comments', require('./routes/commentRoutes'));
app.use('/chat', require('./routes/chatRoutes'));
app.use('/notifications', require('./routes/notificationRoutes'));

// Error handling
app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));