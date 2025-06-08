document.addEventListener('DOMContentLoaded', () => {
  const friendList = document.getElementById('friend-list');
  const minimizedChat = document.getElementById('minimizedChat');
  const minimizedAvatar = document.getElementById('minimizedAvatar');
  const minimizedName = document.getElementById('minimizedName');
  // const minimizedUnread = document.getElementById('minimizedUnread');
  const sidebar = document.querySelector('.sidebar-right');
  window.currentUserId = sidebar.dataset.currentUserId;
  console.log('Current user ID set:', window.currentUserId);

  const socket = io();

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
        // const totalUnread = Object.values(data.unreadMap).reduce((sum, count) => sum + count, 0);
        //  minimizedUnread.textContent = totalUnread;
        //  minimizedUnread.classList.toggle('hidden', totalUnread === 0);

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

  updateUnreadCount();
});