const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const redisClient = require('../config/redis');
const s3 = require('../config/backblaze');
const cloudinary = require('../config/cloudinary');
const path = require('path');


const chatController = {
  getChatPage: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user._id) {
        console.error('Session user not found');
        return res.status(401).render('pages/error', {
          message: 'Vui lòng đăng nhập để truy cập trang chat',
          layout: 'layouts/main'
        });
      }
      const userId = req.session.user._id;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId:', userId);
        return res.status(400).render('pages/error', {
          message: 'ID người dùng không hợp lệ',
          layout: 'layouts/main'
        });
      }
      console.log('Fetching friends for userId:', userId);
      const friends = await User.find({ _id: { $ne: userId } })
        .select('username avatar')
        .sort({ username: 1 })
        .lean();

      console.log('Fetching unread counts for userId:', userId);
      const unreadCounts = await Message.aggregate([
        {
          $match: {
            receiver: new mongoose.Types.ObjectId(userId),
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

      const unreadMap = {};
      unreadCounts.forEach(item => {
        unreadMap[item._id.toString()] = item.count;
      });

      res.render('pages/chat', {
        title: 'Chat',
        userId,
        friends,
        unreadMap,
        csrfToken: res.locals.csrfToken
      });
    } catch (error) {
      console.error('Error loading chat page:', error.stack);
      res.status(500).render('pages/error', {
        message: 'Không thể tải trang chat',
        layout: 'layouts/main'
      });
    }
  },

  getMessagesWithUser: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user._id) {
        return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập' });
      }
      const userId = req.session.user._id;
      const otherUserId = req.params.userId;
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(otherUserId)) {
        console.error('Invalid userId or otherUserId:', { userId, otherUserId });
        return res.status(400).json({ success: false, error: 'ID người dùng không hợp lệ' });
      }

      const redisKey = `chat:${[userId, otherUserId].sort().join(':')}`;
      const cached = await redisClient.get(redisKey);
      if (cached) {
        return res.json({
          success: true,
          messages: JSON.parse(cached)
        });
      }

      const messages = await Message.find({
        $or: [
          { sender: new mongoose.Types.ObjectId(userId), receiver: new mongoose.Types.ObjectId(otherUserId) },
          { sender: new mongoose.Types.ObjectId(otherUserId), receiver: new mongoose.Types.ObjectId(userId) }
        ]
      })
        .populate('sender', 'username avatar')
        .populate('receiver', 'username avatar')
        .sort({ createdAt: 1 })
        .limit(4444);// !!! Chỉ dùng tạm. Nên thay bằng kỹ thuật infinite scroll để tránh tải quá nhiều tin nhắn cùng lúc.

      await redisClient.setEx(redisKey, 60, JSON.stringify(messages));

      res.json({ success: true, messages });
    } catch (error) {
      console.error('Error fetching messages:', error.stack);
      res.status(500).json({ success: false, error: 'Không thể lấy tin nhắn' });
    }
  },

  sendMessage: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user._id) {
        return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập' });
      }
      const { receiverId, content } = req.body;
      const senderId = req.session.user._id;

      console.log('POST Request Body:', req.body);
      console.log('POST Request Files:', req.files);

      if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
        console.error('Invalid senderId or receiverId:', { senderId, receiverId });
        return res.status(400).json({ success: false, error: 'ID người dùng không hợp lệ' });
      }

      // Kiểm tra ít nhất phải có content hoặc file
      if ((!content || content.trim() === '') && (!req.files || (!req.files.media && !req.files.files))) {
        return res.status(400).json({ success: false, error: 'Phải cung cấp nội dung hoặc file' });
      }

      // Xử lý file upload
      let filesData = [];
      if (req.files && (req.files.media || req.files.files)) {
        const uploadPromises = [];

        // Xử lý media files (Cloudinary)
        if (req.files.media) {
          req.files.media.forEach(file => {
            const fileName = `chat_${Date.now()}_${file.originalname}`;
            const resourceType = file.mimetype.startsWith('video/') ? 'video' : file.mimetype.startsWith('audio/') ? 'raw' : 'image';
            uploadPromises.push(
              new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                  {
                    folder: 'social-network/message',
                    public_id: fileName,
                    resource_type: resourceType
                  },
                  (error, uploadResult) => {
                    if (error) return reject(new Error(`Cloudinary upload failed: ${error.message}`));
                    resolve({
                      url: uploadResult.secure_url,
                      key: uploadResult.public_id,
                      name: file.originalname,
                      mimeType: file.mimetype,
                      size: file.size,
                      expiresAt: new Date('4444-04-04'),
                      storage: 'cloudinary'
                    });
                  }
                ).end(file.buffer);
              })
            );
          });
        }

        // Xử lý other files (Backblaze B2)
        if (req.files.files) {
          req.files.files.forEach(file => {
            const fileName = `chat_${Date.now()}_${file.originalname}`;
            const key = `uploads/${fileName}`;
            const params = {
              Bucket: process.env.B2_BUCKET_NAME,
              Key: key,
              Body: file.buffer,
              ContentType: file.mimetype
            };

            uploadPromises.push(
              s3.upload(params).promise().then(() => {
                return s3.getSignedUrlPromise('getObject', {
                  Bucket: process.env.B2_BUCKET_NAME,
                  Key: key,
                  Expires: 7 * 24 * 60 * 60 // 7 ngày
                }).then(signedUrl => ({
                  url: signedUrl,
                  key: key,
                  name: file.originalname,
                  mimeType: file.mimetype,
                  size: file.size,
                  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                  storage: 'backblaze'
                }));
              })
            );
          });
        }

        filesData = await Promise.all(uploadPromises);
      }

      const message = new Message({
        sender: new mongoose.Types.ObjectId(senderId),
        receiver: new mongoose.Types.ObjectId(receiverId),
        content: content ? content.trim() : undefined,
        files: filesData,
        createdAt: new Date()
      });

      await message.save();
      await message.populate('sender', 'username avatar');
      await message.populate('receiver', 'username avatar');

      const redisKey = `chat:${[senderId, receiverId].sort().join(':')}`;
      await redisClient.del(redisKey);

      // Emit socket event để thông báo tin nhắn mới
      req.io.to(`user_${receiverId}`).emit('private_message', { message, from: senderId });
      req.io.to(`user_${senderId}`).emit('message_sent', { success: true, message });

      res.json({ success: true, message });
    } catch (error) {
      console.error('Error sending message:', error.stack);
      res.status(500).json({ success: false, error: `Không thể gửi tin nhắn: ${error.message}` });
    }
  },

  markAsRead: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user._id) {
        return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập' });
      }
      const { messageIds } = req.body;
      const userId = req.session.user._id;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId:', userId);
        return res.status(400).json({ success: false, error: 'ID người dùng không hợp lệ' });
      }
      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Danh sách messageIds không hợp lệ' });
      }

      await Message.updateMany(
        { _id: { $in: messageIds }, receiver: new mongoose.Types.ObjectId(userId), isRead: false },
        { isRead: true }
      );

      const redisKeys = await redisClient.keys(`chat:${userId}:*`);
      if (redisKeys.length > 0) {
        await redisClient.del(redisKeys);
      }

      res.json({ success: true, message: 'Đã đánh dấu tin nhắn đã đọc' });
    } catch (error) {
      console.error('Error marking messages as read:', error.stack);
      res.status(500).json({ success: false, error: 'Không thể đánh dấu tin nhắn đã đọc' });
    }
  },

  getUnreadCount: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user._id) {
        return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập' });
      }
      const userId = req.session.user._id;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId:', userId);
        return res.status(400).json({ success: false, error: 'ID người dùng không hợp lệ' });
      }

      const unreadCounts = await Message.aggregate([
        {
          $match: {
            receiver: new mongoose.Types.ObjectId(userId),
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

      const unreadMap = {};
      unreadCounts.forEach(item => {
        unreadMap[item._id.toString()] = item.count;
      });

      res.json({ success: true, unreadMap });
    } catch (error) {
      console.error('Error getting unread count:', error.stack);
      res.status(500).json({ success: false, error: 'Không thể lấy số tin nhắn chưa đọc' });
    }
  },

  handleSocketConnection: (io) => {
    io.on('connection', (socket) => {
      console.log('User connected:', socket.id);
      socket.on('auth', async (userId) => {
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
          console.error('Invalid userId:', userId);
          return;
        }
        try {
          await redisClient.set(`user:${userId}`, socket.id, { EX: 86400 });
          socket.handshake.auth = { userId };
          socket.join(`user_${userId}`);
          console.log(`Stored userId ${userId} in Redis`);
        } catch (err) {
          console.error('Redis set error:', err);
        }
      });

      socket.on('send_message', async (data) => {
        try {
          const { receiverId, senderId } = data;
          if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
            console.error('Invalid senderId or receiverId:', { senderId, receiverId });
            socket.emit('message_error', { success: false, error: 'ID không hợp lệ' });
            return;
          }
          console.log(`Forwarding message from ${senderId} to ${receiverId}`);
        } catch (error) {
          console.error('Error handling send_message:', error.stack);
          socket.emit('message_error', { success: false, error: 'Không thể xử lý tin nhắn' });
        }
      });

      socket.on('mark_read', async (data) => {
        try {
          const { senderId, receiverId, messageIds } = data;
          if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
            console.error('Invalid senderId or receiverId:', { senderId, receiverId });
            return;
          }
          if (!Array.isArray(messageIds) || !messageIds.length) {
            console.error('Invalid or empty messageIds:', messageIds);
            return;
          }

          await Message.updateMany(
            { _id: { $in: messageIds }, sender: new mongoose.Types.ObjectId(senderId), receiver: new mongoose.Types.ObjectId(receiverId), isRead: false },
            { isRead: true }
          );

          io.to(`user_${senderId}`).emit('messages_read', { readBy: receiverId, senderId, messageIds });
          io.to(`user_${receiverId}`).emit('messages_read', { readBy: receiverId, senderId, messageIds });
          console.log(`Messages marked as read by ${receiverId} from ${senderId}`);
        } catch (error) {
          console.error('Error marking messages as read:', error.stack);
        }
      });

      socket.on('user_typing', (data) => {
        const { receiverId, isTyping } = data;
        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          console.error('Invalid receiverId:', receiverId);
          return;
        }
        socket.to(`user_${receiverId}`).emit('user_typing', {
          userId: socket.handshake.auth.userId,
          isTyping
        });
      });

      socket.on('disconnect', async () => {
        if (socket.handshake.auth.userId) {
          await redisClient.del(`user:${socket.handshake.auth.userId}`);
        }
        console.log('User disconnected:', socket.id);
      });
    });
  }
};

module.exports = chatController;