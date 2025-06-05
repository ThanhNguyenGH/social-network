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
// Format ngày tháng tin nhắn
function formatMessageDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    return;
  }

  try {
    const res = await fetch(`/chat/messages/${userId}`);
    const data = await res.json();
    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML = '';

    if (data.success && data.messages.length > 0) {
      let lastDate = null;
      let lastSenderId = null;

      data.messages.forEach((msg, index) => {
        // Kiểm tra dữ liệu tin nhắn
        if (!msg.content || !msg.sender || !msg.sender._id || !msg.sender.username) {
          console.warn('Invalid message data:', msg);
          return;
        }

        const isSender = msg.sender._id === currentUserId;
        const currentDate = formatMessageDate(msg.createdAt);

        // Thêm ngày tháng nếu ngày thay đổi
        if (lastDate !== currentDate) {
          const dateDiv = document.createElement('div');
          dateDiv.className = 'text-center my-2';
          dateDiv.innerHTML = `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${currentDate}</span>`;
          chatBox.appendChild(dateDiv);
          lastDate = currentDate;
          lastSenderId = null; // Reset để hiển thị avatar cho tin nhắn đầu tiên của ngày mới
        }

        // Xác định có hiển thị avatar hay không
        const showAvatar = !isSender && lastSenderId !== msg.sender._id;
        lastSenderId = msg.sender._id;

        const div = document.createElement('div');
        div.className = `flex ${isSender ? 'justify-end' : 'justify-start'} mb-1`;
        div.dataset.id = msg._id;

        // HTML cho tin nhắn
        div.innerHTML = `
  <div class="flex items-start ${isSender ? 'flex-row-reverse' : ''}">
    ${
      showAvatar
        ? `<img src="${msg.sender.avatar || '/default-avatar.png'}" alt="Avatar" class="w-8 h-8 rounded-full ${isSender ? 'ml-2' : 'mr-2'}">`
        : isSender
        ? ''
        : '<div class="w-8 h-8 mr-2"></div>' // Placeholder để căn chỉnh
    }
    <div class="inline-block px-3 py-2 rounded ${isSender ? 'bg-blue-200' : 'bg-gray-200'}">
      <p>${msg.content}</p>
      <p class="text-xs text-gray-500">${formatMessageTime(msg.createdAt)}</p>
      ${
        isSender && msg._id === getLastSeenMessageId(data.messages, currentUserId)
          ? '<p class="text-xs text-gray-500 seen-indicator">Đã xem</p>'
          : ''
      }
    </div>
  </div>
`;
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
  updateUnreadCount(); // Cập nhật số tin nhắn chưa đọc
}
  } catch (error) {
    console.error('Error loading messages:', error);
  }
});

function getLastSeenMessageId(messages, currentUserId) {
  const sentByUser = messages.filter(m => m.sender._id === currentUserId && m.isRead);
  if (sentByUser.length === 0) return null;
  return sentByUser[sentByUser.length - 1]._id;
}

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

    // Gửi socket để đánh dấu đã đọc
    if (currentUserId) {
      socket.emit('mark_read', { senderId: userId, receiverId: currentUserId });
      updateUnreadCount(); // Cập nhật số tin nhắn chưa đọc
    }

    // Gửi sự kiện mở modal chat
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

  // Gửi tin nhắn đến server
  socket.emit('send_message', {
    senderId: currentUserId,
    receiverId: currentChatUserId,
    content
  });
  input.value = '';

  // Tạo phần tử hiển thị tin nhắn tạm thời
  const chatBox = document.getElementById('chatMessages');
  const currentDate = formatMessageDate(new Date());

  // Tìm div ngày tháng cuối cùng
  let lastDate = null;
  const lastDateDiv = Array.from(chatBox.children)
    .reverse()
    .find(el => el.classList.contains('text-center'));
  if (lastDateDiv && lastDateDiv.querySelector('span')) {
    lastDate = lastDateDiv.querySelector('span').textContent;
  }

  // Thêm ngày tháng nếu ngày thay đổi
  if (lastDate !== currentDate) {
    const dateDiv = document.createElement('div');
    dateDiv.className = 'text-center my-2';
    dateDiv.innerHTML = `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${currentDate}</span>`;
    chatBox.appendChild(dateDiv);
  }

  const div = document.createElement('div');
  div.className = 'flex justify-end mb-1';
  div.dataset.temp = 'true';
  div.innerHTML = `
    <div class="flex items-start flex-row-reverse">
      <div class="inline-block px-3 py-2 rounded bg-blue-200">
        <p>${content}</p>
        <p class="text-xs text-gray-500">${formatMessageTime(new Date())}</p>
      </div>
    </div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Nhận tin nhắn real-time
socket.on('private_message', ({ message, from }) => {
  const chatModal = document.getElementById('chatModal');
  const isCurrentChat = currentChatUserId === message.sender._id || currentChatUserId === message.receiver._id;

  if (isCurrentChat && !chatModal.classList.contains('hidden')) {
    if (!message.content || !message.sender || !message.sender.username) {
      console.warn('Invalid message data:', message);
      return;
    }

    const chatBox = document.getElementById('chatMessages');
    const isSender = message.sender._id === currentUserId;
    const currentDate = formatMessageDate(message.createdAt);

    // Tìm div ngày tháng cuối cùng
    let lastDate = null;
    const lastDateDiv = Array.from(chatBox.children)
      .reverse()
      .find(el => el.classList.contains('text-center'));
    if (lastDateDiv && lastDateDiv.querySelector('span')) {
      lastDate = lastDateDiv.querySelector('span').textContent;
    }

    // Thêm ngày tháng nếu ngày thay đổi
    if (lastDate !== currentDate) {
      const dateDiv = document.createElement('div');
      dateDiv.className = 'text-center my-2';
      dateDiv.innerHTML = `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${currentDate}</span>`;
      chatBox.appendChild(dateDiv);
    }

    // Xác định có hiển thị avatar hay không
    const lastSenderId = chatBox.lastElementChild?.dataset.senderId || null;
    const showAvatar = !isSender && lastSenderId !== message.sender._id;

    // Thay thế tin nhắn tạm thời nếu là tin nhắn của người gửi
    if (isSender) {
      const tempMsg = chatBox.querySelector('div[data-temp="true"]');
      const div = document.createElement('div');
      div.className = `flex justify-end mb-1`;
      div.dataset.id = message._id;
      div.dataset.senderId = message.sender._id;
      div.innerHTML = `
        <div class="flex items-start flex-row-reverse">
          <div class="inline-block px-3 py-2 rounded bg-blue-200">
            <p>${message.content}</p>
            <p class="text-xs text-gray-500">${formatMessageTime(message.createdAt)}</p>
            ${message.isRead ? '<p class="text-xs text-gray-500 seen-indicator">Đã xem</p>' : ''}
          </div>
        </div>
      `;
      if (tempMsg) {
        chatBox.replaceChild(div, tempMsg);
      } else {
        chatBox.appendChild(div);
      }
    } else {
      // Tin nhắn từ người khác
      const div = document.createElement('div');
      div.className = `flex justify-start mb-1`;
      div.dataset.id = message._id;
      div.dataset.senderId = message.sender._id;
      div.innerHTML = `
        <div class="flex items-start">
          ${
            showAvatar
              ? `<img src="${message.sender.avatar || '/images/default-avatar.png'}" alt="Avatar" class="w-8 h-8 rounded-full mr-2">`
              : '<div class="w-8 h-8 mr-2"></div>'
          }
          <div class="inline-block px-3 py-2 rounded bg-gray-200">
            <p>${message.content}</p>
            <p class="text-xs text-gray-500">${formatMessageTime(message.createdAt)}</p>
          </div>
        </div>
      `;
      chatBox.appendChild(div);
    }

    chatBox.scrollTop = chatBox.scrollHeight;

    // Đánh dấu tin nhắn đã đọc nếu là tin nhắn từ người khác
    if (!message.isRead && message.receiver._id === currentUserId) {
      fetch('/chat/mark-as-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ messageIds: [message._id] })
      }).then(() => {
        socket.emit('mark_read', {
          senderId: message.sender._id,
          receiverId: currentUserId,
          messageIds: [message._id]
        });
        updateUnreadCount();
      });
    }
  } else {
    updateUnreadCount();
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
socket.on('messages_read', ({ readBy, senderId, messageIds }) => {
  if (readBy === currentChatUserId && Array.isArray(messageIds) && messageIds.length > 0) {
    const chatBox = document.getElementById('chatMessages');

    // Xóa tất cả chỉ báo "Đã xem" hiện có
    chatBox.querySelectorAll('.seen-indicator').forEach(e => e.remove());

    // Cập nhật tất cả tin nhắn trong messageIds
    const messageElems = Array.from(chatBox.children);
    messageElems.forEach(el => {
      const msgId = el.dataset.id;
      if (el.classList.contains('justify-end') && messageIds.includes(msgId)) {
        const seen = document.createElement('p');
        seen.className = 'seen-indicator text-xs text-gray-500';
        seen.textContent = 'Đã xem';
        el.querySelector('div').appendChild(seen);
      }
    });
  }
});

async function updateUnreadCount() {
  try {
    const res = await fetch('/chat/unread-count', {
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      }
    });
    const data = await res.json();
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
      // Cập nhật minimizedUnread
      const totalUnread = Object.values(data.unreadMap).reduce((sum, count) => sum + count, 0);
      const minimizedUnread = document.getElementById('minimizedUnread');
      if (minimizedUnread) {
        minimizedUnread.textContent = totalUnread;
        minimizedUnread.classList.toggle('hidden', totalUnread === 0);
      }
    }
  } catch (error) {
    console.error('Error updating unread count:', error);
  }
}

document.addEventListener('updateUnreadCount', () => {
  updateUnreadCount();
});

// Hàm hiển thị toast
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-lg shadow-lg z-50';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}