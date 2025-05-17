require('dotenv').config();
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
require('./config/passport');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Tăng timeout server
server.setTimeout(60000);

// Kết nối MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https://res.cloudinary.com", "data:"],
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
    // Tạo CSRF token cho GET requests
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

// Xử lý lỗi Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer Error:', err);
    return res.status(400).render('pages/error', {
      message: `Multer error: ${err.message}`,
      user: req.session.user,
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
  max: 100
}));

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// Routes
app.get('/', (req, res) => {
  if (req.session.user || req.isAuthenticated()) {
    res.redirect('/home');
  } else {
    res.redirect('/auth/login');
  }
});

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