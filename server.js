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
require('./config/passport');

// Log REDIS_URL để debug (che password)
console.log('REDIS_URL in server.js:', process.env.REDIS_URL ? process.env.REDIS_URL.replace(/:[^@]+@/, ':****@') : 'undefined');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Kết nối MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// EJS và Layout
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // Chỉ định main.ejs làm layout mặc định

// Session với Redis
const sessionMiddleware = session({
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:', // Đảm bảo prefix cho session
    ttl: 86400 // 1 ngày (giây)
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 1 ngày
    httpOnly: true
  }
});

app.use(sessionMiddleware);

// Debug session và lưu vào Redis
app.use(async (req, res, next) => {
  console.log('Session data:', req.session);
  if (req.session.user) {
    try {
      // Kiểm tra session trong Redis
      const sessionId = req.sessionID;
      const sessionData = await redisClient.get(`sess:${sessionId}`);
      console.log(`Redis session [sess:${sessionId}]:`, sessionData ? 'Stored' : 'Not stored');
    } catch (err) {
      console.error('Error checking Redis session:', err);
    }
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

// CSRF protection
app.use(csurf());

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests
}));

// Pass CSRF token and user to views
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  res.locals.user = req.user || req.session.user;
  next();
});

// Socket.io (placeholder)
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// Routes
app.get('/', (req, res) => {
  if (req.session.user || req.isAuthenticated()) {
    res.redirect('/home'); // Nếu đã đăng nhập, redirect đến /home
  } else {
    res.redirect('/auth/login'); // Chưa đăng nhập, redirect đến login
  }
});

app.use('/auth', require('./routes/authRoutes'));
app.use('/users', require('./routes/userRoutes'));
app.use(require('./routes/postRoutes')); // Bỏ prefix /posts để /home hoạt động trực tiếp
app.use('/comments', require('./routes/commentRoutes'));
app.use('/chat', require('./routes/chatRoutes'));
app.use('/notifications', require('./routes/notificationRoutes'));

// Error handling
app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));