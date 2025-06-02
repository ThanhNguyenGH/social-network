document.addEventListener('DOMContentLoaded', () => {
  const friendList = document.getElementById('friend-list');
  const minimizedChat = document.getElementById('minimizedChat');
  const minimizedAvatar = document.getElementById('minimizedAvatar');
  const minimizedName = document.getElementById('minimizedName');
  const minimizedUnread = document.getElementById('minimizedUnread');
  const sidebar = document.querySelector('.sidebar-right');
  window.currentUserId = sidebar.dataset.currentUserId; // Lấy currentUserId từ data attribute
  console.log('Current user ID set:', window.currentUserId); // Debug

  // Khởi tạo Socket.IO
  const socket = io();

  // Hàm cập nhật số tin nhắn chưa đọc
  const updateUnreadCount = async () => {
    try {
      const response = await fetch('/chat/unread-count', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        minimizedUnread.textContent = data.unreadCount;
        minimizedUnread.classList.toggle('hidden', data.unreadCount === 0);
      }
    } catch (error) {
      console.error('Error updating unread count:', error);
    }
  };

  // Xử lý click vào friend item để mở chat modal
  friendList.addEventListener('click', async (event) => {
    const friendItem = event.target.closest('.friend-item');
    if (!friendItem) return;

    const userId = friendItem.dataset.id;
    const username = friendItem.dataset.username;
    const avatar = friendItem.dataset.avatar;

    // Cập nhật minimized chat info
    minimizedAvatar.src = avatar;
    minimizedName.textContent = username;
    minimizedChat.dataset.userId = userId;
    minimizedChat.classList.remove('hidden');

    // Kích hoạt sự kiện mở chat modal
    const openChatEvent = new CustomEvent('openChatModal', {
      detail: { userId, username, avatar }
    });
    document.dispatchEvent(openChatEvent);

    // Đánh dấu tin nhắn đã đọc
    try {
      const response = await fetch('/chat/messages/' + userId, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success && data.messages.length > 0) {
        const messageIds = data.messages
          .filter(msg => msg.receiver._id === window.currentUserId && !msg.isRead)
          .map(msg => msg._id);
        if (messageIds.length > 0) {
          await fetch('/chat/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds })
          });
          socket.emit('mark_read', { senderId: userId });
        }
      }
      updateUnreadCount();
    } catch (error) {
      console.error('Error handling friend click:', error);
    }
  });

  // Xử lý click vào minimized chat để mở lại modal
  minimizedChat.addEventListener('click', () => {
    const userId = minimizedChat.dataset.userId;
    const username = minimizedName.textContent;
    const avatar = minimizedAvatar.src;

    const openChatEvent = new CustomEvent('openChatModal', {
      detail: { userId, username, avatar }
    });
    document.dispatchEvent(openChatEvent);
  });

  // Lắng nghe sự kiện tin nhắn mới từ Socket.IO
  socket.on('new_message', ({ message }) => {
    if (message.sender._id !== window.currentUserId) {
      updateUnreadCount();
    }
  });

  // Cập nhật số tin nhắn chưa đọc khi tải trang
  updateUnreadCount();
});