const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const redisClient = require('../config/redis');

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
        .limit(50);

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
      if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
        console.error('Invalid senderId or receiverId:', { senderId, receiverId });
        return res.status(400).json({ success: false, error: 'ID người dùng không hợp lệ' });
      }
      if (!content || content.trim() === '') {
        return res.status(400).json({ success: false, error: 'Nội dung tin nhắn không được để trống' });
      }

      const message = new Message({
        sender: new mongoose.Types.ObjectId(senderId),
        receiver: new mongoose.Types.ObjectId(receiverId),
        content: content.trim()
      });
      await message.save();
      await message.populate('sender', 'username avatar');
      await message.populate('receiver', 'username avatar');

      const redisKey = `chat:${[senderId, receiverId].sort().join(':')}`;
      await redisClient.del(redisKey);

      res.json({ success: true, message });
    } catch (error) {
      console.error('Error sending message:', error.stack);
      res.status(500).json({ success: false, error: 'Không thể gửi tin nhắn' });
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

      // Xóa cache Redis liên quan
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
          const { receiverId, content, senderId } = data;
          console.log('Received send_message:', { senderId, receiverId, content }); // Debug

          if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
            console.error('Invalid senderId or receiverId:', { senderId, receiverId });
            socket.emit('message_error', { success: false, error: 'ID không hợp lệ' });
            return;
          }
          if (!content || content.trim() === '') {
            console.error('Empty message content:', content);
            socket.emit('message_error', { success: false, error: 'Nội dung tin nhắn không được để trống' });
            return;
          }

          const message = new Message({
            sender: new mongoose.Types.ObjectId(senderId),
            receiver: new mongoose.Types.ObjectId(receiverId),
            content: content.trim(),
            createdAt: new Date()
          });

          // Lưu tin nhắn và kiểm tra kết quả
          await message.save();
          console.log(`Message saved to MongoDB: ${message._id}`); // Debug
          await message.populate('sender', 'username avatar');
          await message.populate('receiver', 'username avatar');

          io.to(`user_${receiverId}`).emit('private_message', { message, from: senderId });
          socket.emit('message_sent', { success: true, message });
           console.log(`Message sent from ${senderId} to ${receiverId}`);

          try {
            const redisKey = `chat:${[senderId, receiverId].sort().join(':')}`;
            await redisClient.del(redisKey);
          } catch (err) {
            console.error('Redis cache clear failed:', err);
          }
        } catch (error) {
          console.error('Error saving message to MongoDB:', error.stack);
          socket.emit('message_error', { success: false, error: 'Không thể gửi tin nhắn' });
        }
      });

      socket.on('mark_read', async (data) => {
        try {
          const { senderId, receiverId } = data;
          if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
            console.error('Invalid senderId or receiverId:', { senderId, receiverId });
            return;
          }

          await Message.updateMany(
            { sender: new mongoose.Types.ObjectId(senderId), receiver: new mongoose.Types.ObjectId(receiverId), isRead: false },
            { isRead: true }
          );

          // Gửi sự kiện messages_read đến cả sender và receiver
          io.to(`user_${senderId}`).emit('messages_read', { readBy: receiverId, senderId });
          io.to(`user_${receiverId}`).emit('messages_read', { readBy: receiverId, senderId });
          console.log(`Messages marked as read by ${receiverId} from ${senderId}`);
        } catch (error) {
          console.error('Error marking messages as read:', error.stack);
        }
      });

      socket.on('typing', (data) => {
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