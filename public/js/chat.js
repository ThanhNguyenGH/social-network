document.addEventListener('DOMContentLoaded', () => {
  const friendList = document.getElementById('friend-list');
  const container = document.querySelector('.container');
  const socket = io();
  const currentUserId = container.dataset.currentUserId;

  // Tham gia phòng Socket.IO
  if (currentUserId) {
    socket.emit('auth', currentUserId);
  }

  // Cập nhật số tin nhắn chưa đọc
  const updateUnreadCount = async () => {
    try {
      const response = await fetch('/chat/unread-count', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success && data.unreadMap) {
        document.querySelectorAll('.friend-item').forEach(item => {
          const friendId = item.dataset.id;
          const badge = item.querySelector('.unread-badge');
          if (badge) {
            const count = data.unreadMap[friendId] || 0;
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
            if (count > 0) {
              badge.classList.add('animate-pulse');
            } else {
              badge.classList.remove('animate-pulse');
            }
          }
        });
      }
    } catch (error) {
      console.error('Error updating unread count:', error);
    }
  };

  // Xử lý click vào bạn bè
  friendList.addEventListener('click', async (event) => {
    const friendItem = event.target.closest('.friend-item');
    if (!friendItem) return;

    const userId = friendItem.dataset.id;
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.error('Invalid friend ID:', userId);
      return;
    }
    const username = friendItem.dataset.username;
    const avatar = friendItem.dataset.avatar;

    // Kích hoạt sự kiện mở chat modal
    const openChatEvent = new CustomEvent('openChatModal', {
      detail: { userId, username, avatar }
    });
    document.dispatchEvent(openChatEvent);

    // Đánh dấu tin nhắn đã đọc
    try {
      const response = await fetch(`/chat/messages/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success && data.messages.length > 0) {
        const messageIds = data.messages
          .filter(msg => msg.receiver._id === currentUserId && !msg.isRead)
          .map(msg => msg._id);
        if (messageIds.length > 0) {
          await fetch('/chat/mark-as-read', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({ messageIds })
          });
          socket.emit('mark_read', { senderId: userId, receiverId: currentUserId });
        }
      }
      updateUnreadCount(); // Cập nhật badge ngay sau khi mở modal
    } catch (error) {
      console.error('Error handling friend click:', error);
    }
  });

  // Lắng nghe sự kiện cập nhật badge
  document.addEventListener('updateUnreadCount', updateUnreadCount);

  // Socket.IO: Lắng nghe tin nhắn mới
  socket.on('private_message', ({ message }) => {
    if (message.sender._id !== currentUserId) {
      updateUnreadCount();
    }
  });

  // Lắng nghe sự kiện messages_read
  socket.on('messages_read', ({ readBy, senderId }) => {
    updateUnreadCount();
  });

  // Khởi tạo
  updateUnreadCount();
});