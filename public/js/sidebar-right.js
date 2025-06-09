document.addEventListener('DOMContentLoaded', () => {
  const friendList = document.getElementById('friend-list');
  const minimizedChat = document.getElementById('minimizedChat');
  const minimizedAvatar = document.getElementById('minimizedAvatar');
  const minimizedName = document.getElementById('minimizedName');
  const sidebar = document.querySelector('.sidebar-right');
  window.currentUserId = sidebar.dataset.currentUserId;
  console.log('Current user ID set:', window.currentUserId);

  const socket = io();

  // Gửi userId khi kết nối
  if (window.currentUserId) {
    socket.emit('user:connect', { userId: window.currentUserId });
  }

  // Lấy danh sách user online khi tải trang
  async function fetchOnlineUsers() {
    try {
      const response = await fetch('/users/online', {
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        }
      });
      const data = await response.json();
      if (data.success) {
        document.querySelectorAll('.friend-item').forEach(item => {
          const userId = item.dataset.id;
          let statusDot = item.querySelector('.status-dot');
          const isOnline = data.onlineUsers.includes(userId);

          if (isOnline) {
            if (!statusDot) {
              statusDot = document.createElement('span');
              statusDot.className = 'status-dot w-3 h-3 rounded-full absolute top-0 right-0 bg-green-500';
              item.style.position = 'relative';
              item.appendChild(statusDot);
            } else {
              statusDot.className = 'status-dot w-3 h-3 rounded-full absolute top-0 right-0 bg-green-500';
              statusDot.style.display = 'block';
            }
          } else {
            if (statusDot) {
              statusDot.style.display = 'none';
            }
          }
        });
      }
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  }

  // Cập nhật trạng thái online từ Socket.IO
  socket.on('user:status', ({ userId, isOnline }) => {
    const friendItem = document.querySelector(`.friend-item[data-id="${userId}"]`);
    if (friendItem) {
      let statusDot = friendItem.querySelector('.status-dot');
      if (isOnline) {
        if (!statusDot) {
          statusDot = document.createElement('span');
          statusDot.className = 'status-dot w-3 h-3 rounded-full absolute top-0 right-0 bg-green-500';
          friendItem.style.position = 'relative';
          friendItem.appendChild(statusDot);
        } else {
          statusDot.className = 'status-dot w-3 h-3 rounded-full absolute top-0 right-0 bg-green-500';
          statusDot.style.display = 'block';
        }
      } else {
        if (statusDot) {
          statusDot.style.display = 'none';
        }
      }
    }
  });

  async function updateUnreadCount() {
    try {
      const response = await fetch('/chat/unread-count', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        }
      });
      const data = await response.json();
      if (data.success) {
        document.querySelectorAll('.friend-item').forEach(item => {
          const userId = item.dataset.id;
          const unreadBadge = item.querySelector('.unread-badge');
          const count = data.unreadMap[userId] || 0;
          if (unreadBadge) {
            if (count > 0) {
              unreadBadge.textContent = count;
              unreadBadge.style.display = 'inline';
            } else {
              unreadBadge.textContent = '';
              unreadBadge.style.display = 'none';
            }
          }
        });
      }
    } catch (error) {
      console.error('Error updating unread count:', error);
    }
  }

  friendList.addEventListener('click', async (event) => {
    const friendItem = event.target.closest('.friend-item');
    if (!friendItem) return;

    const userId = friendItem.dataset.id;
    const username = friendItem.dataset.username;
    const avatar = friendItem.dataset.avatar;

    minimizedAvatar.src = avatar;
    minimizedName.textContent = username;
    minimizedChat.dataset.userId = userId;
    minimizedChat.classList.remove('hidden');

    const openChatEvent = new CustomEvent('openChatModal', {
      detail: { userId, username, avatar }
    });
    document.dispatchEvent(openChatEvent);
  });

  minimizedChat.addEventListener('click', () => {
    const userId = minimizedChat.dataset.userId;
    const username = minimizedName.textContent;
    const avatar = minimizedAvatar.src;

    const openChatEvent = new CustomEvent('openChatModal', {
      detail: { userId, username, avatar }
    });
    document.dispatchEvent(openChatEvent);
  });

  socket.on('private_message', ({ message }) => {
    const chatModal = document.getElementById('chatModal');
    if (
      message.sender._id !== window.currentUserId &&
      (!chatModal || chatModal.classList.contains('hidden') || message.sender._id !== chatModal.dataset.userId)
    ) {
      updateUnreadCount();
    }
  });

  socket.on('messages_read', ({ readBy }) => {
    updateUnreadCount();
  });

  // Gọi khi tải trang
  fetchOnlineUsers();
  updateUnreadCount();
});