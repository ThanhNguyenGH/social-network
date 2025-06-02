// chat-modal.js
const socket = io();
let currentChatUserId = null;
let currentUserId = document.body.dataset.userId || window.currentUserId;

// Tham gia phòng Socket.IO
if (currentUserId) {
  socket.emit('auth', currentUserId);
}

// Format thời gian tin nhắn
function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Xử lý sự kiện openChatModal
document.addEventListener('openChatModal', async (event) => {
  const { userId, username, avatar } = event.detail;
  console.log('Received openChatModal event:', { userId, username, avatar });

  if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
    console.error('Invalid userId in openChatModal:', userId);
    return;
  }

  currentChatUserId = userId;
  document.getElementById('chatWithUsername').textContent = `Đang trò chuyện với ${username}`;
  const chatModal = document.getElementById('chatModal');
  if (chatModal) {
    chatModal.classList.remove('hidden');
    chatModal.dataset.userId = userId;
  } else {
    console.error('Chat modal element not found');
  }

  try {
    const res = await fetch(`/chat/messages/${userId}`);
    const data = await res.json();
    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML = '';
    if (data.success) {
      data.messages.forEach(msg => {
        // Kiểm tra dữ liệu tin nhắn
        if (!msg.content || !msg.sender || !msg.sender.username) {
          console.warn('Invalid message data:', msg);
          return;
        }
        const isSender = msg.sender._id === currentUserId;
        const div = document.createElement('div');
        div.className = isSender ? 'text-right' : 'text-left';
        div.innerHTML = `
          <div class="inline-block px-3 py-2 m-1 rounded ${isSender ? 'bg-blue-200' : 'bg-gray-200'}">
            <p class="font-semibold">${msg.sender.username}</p>
            <p>${msg.content}</p>
            <p class="text-xs text-gray-500">${formatMessageTime(msg.createdAt)}</p>
            ${isSender && msg.isRead ? '<p class="text-xs text-gray-500">Đã xem</p>' : ''}
          </div>`;
        chatBox.appendChild(div);
      });
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Đánh dấu tin nhắn đã đọc
    const unreadIds = data.messages
      .filter(msg => msg && !msg.isRead && msg.receiver && msg.receiver._id === currentUserId)
      .map(msg => msg._id);

    if (unreadIds.length > 0) {
      await fetch('/chat/mark-as-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ messageIds: unreadIds })
      });
      socket.emit('mark_read', { senderId: userId, receiverId: currentUserId });
      // Cập nhật badge
      const updateEvent = new CustomEvent('updateUnreadCount');
      document.dispatchEvent(updateEvent);
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
});

// Xử lý click friend-item
document.querySelectorAll('.friend-item').forEach(item => {
  item.addEventListener('click', async () => {
    const userId = item.dataset.id;
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.error('Invalid userId:', userId);
      return;
    }
    const username = item.dataset.username;
    const avatar = item.dataset.avatar;

    const openChatEvent = new CustomEvent('openChatModal', {
      detail: { userId, username, avatar }
    });
    document.dispatchEvent(openChatEvent);
  });
});

// Đóng modal
document.getElementById('closeChatModal').addEventListener('click', () => {
  document.getElementById('chatModal').classList.add('hidden');
  currentChatUserId = null;
  document.getElementById('typingIndicator').classList.add('hidden');
});

// Gửi tin nhắn
document.getElementById('chatForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content || !currentChatUserId || !/^[0-9a-fA-F]{24}$/.test(currentChatUserId)) {
    console.error('Invalid message or receiverId:', { content, currentChatUserId });
    return;
  }

  socket.emit('send_message', {
    senderId: currentUserId,
    receiverId: currentChatUserId,
    content
  });
  input.value = '';

  const chatBox = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'text-right';
  div.innerHTML = `
    <div class="inline-block px-3 py-2 m-1 rounded bg-blue-200">
      <p class="font-semibold">Bạn</p>
      <p>${content}</p>
      <p class="text-xs text-gray-500">${formatMessageTime(new Date())}</p>
    </div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Xử lý sự kiện typing
document.getElementById('chatInput').addEventListener('input', () => {
  if (currentChatUserId) {
    socket.emit('typing', { receiverId: currentChatUserId, isTyping: true });
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      socket.emit('typing', { receiverId: currentChatUserId, isTyping: false });
    }, 3000);
  }
});

// Nhận tin nhắn real-time
socket.on('private_message', ({ message, from }) => {
  const chatModal = document.getElementById('chatModal');
  const isCurrentChat = currentChatUserId === message.sender._id;

  if (isCurrentChat && !chatModal.classList.contains('hidden')) {
    if (!message.content || !message.sender || !message.sender.username) {
      console.warn('Invalid message data:', message);
      return;
    }
    const chatBox = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'text-left';
    div.innerHTML = `
      <div class="inline-block px-3 py-2 m-1 rounded bg-gray-200">
        <p class="font-semibold">${message.sender.username}</p>
        <p>${message.content}</p>
        <p class="text-xs text-gray-500">${formatMessageTime(message.createdAt)}</p>
      </div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Đánh dấu tin nhắn đã đọc
    if (!message.isRead && message.receiver._id === currentUserId) {
      fetch('/chat/mark-as-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ messageIds: [message._id] })
      });
      socket.emit('mark_read', { senderId: message.sender._id, receiverId: currentUserId });
      const updateEvent = new CustomEvent('updateUnreadCount');
      document.dispatchEvent(updateEvent);
    }
  } else {
    const updateEvent = new CustomEvent('updateUnreadCount');
    document.dispatchEvent(updateEvent);
    showToast(`Tin nhắn mới từ ${message.sender.username}`);
  }
});

// Nhận sự kiện typing
socket.on('user_typing', ({ userId, isTyping }) => {
  if (userId === currentChatUserId) {
    const typingIndicator = document.getElementById('typingIndicator');
    typingIndicator.classList.toggle('hidden', !isTyping);
  }
});

// Nhận sự kiện messages_read
socket.on('messages_read', ({ readBy, senderId }) => {
  if (readBy === currentChatUserId) {
    // Cập nhật trạng thái "đã xem" cho tin nhắn của người gửi
    const chatBox = document.getElementById('chatMessages');
    const messages = chatBox.querySelectorAll('.text-right');
    messages.forEach(msg => {
      if (!msg.querySelector('.seen-indicator')) {
        const seen = document.createElement('p');
        seen.className = 'seen-indicator text-xs text-gray-500';
        seen.textContent = 'Đã xem';
        msg.querySelector('div').appendChild(seen);
      }
    });
  }
  // Cập nhật badge
  const updateEvent = new CustomEvent('updateUnreadCount');
  document.dispatchEvent(updateEvent);
});

// Hàm hiển thị toast
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-lg shadow-lg z-50';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}