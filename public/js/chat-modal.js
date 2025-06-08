const socket = io();
let currentChatUserId = null;
let currentUserId = document.body.dataset.userId || window.currentUserId;
let selectedMedia = [];
let selectedFiles = [];

// Tham gia phòng Socket.IO
if (currentUserId) {
  socket.emit('auth', currentUserId);
}

const sidebar = document.querySelector('.sidebar-right');
if (sidebar) {
  window.currentUserId = sidebar.dataset.currentUserId;
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

// Hiển thị file trong tin nhắn
function renderFile(file) {
  if (file.mimeType.startsWith('image/')) {
    return `<img src="${file.url}" alt="${file.name}" class="max-w-xs h-auto rounded mt-2">`;
  } else if (file.mimeType.startsWith('video/')) {
    return `
      <video controls class="max-w-xs h-auto rounded mt-2">
        <source src="${file.url}" type="${file.mimeType}">
        Trình duyệt của bạn không hỗ trợ phát video.
      </video>`;
  } else if (file.mimeType.startsWith('audio/')) {
    return `<audio src="${file.url}" controls class="mt-2"></audio>`;
  } else {
    // Xác định biểu tượng dựa trên loại file
    let iconClass = 'fa-file';
    if (file.mimeType.includes('pdf')) {
      iconClass = 'fa-file-pdf';
    } else if (file.mimeType.includes('msword') || file.mimeType.includes('wordprocessingml')) {
      iconClass = 'fa-file-word';
    } else if (file.mimeType.includes('ms-excel') || file.mimeType.includes('spreadsheetml')) {
      iconClass = 'fa-file-excel';
    } else if (file.mimeType.includes('zip') || file.mimeType.includes('rar')) {
      iconClass = 'fa-file-archive';
    }

    return `
      <a href="${file.url}" target="_blank" class="flex items-center text-blue-500 hover:underline mt-2">
        <i class="fas ${iconClass} mr-2"></i>
        <span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
      </a>`;
  }
}

// Xử lý kéo thả và chọn file
const dragDropArea = document.getElementById('dragDropArea');
const dragDropMedia = document.getElementById('dragDropMedia');
const dragDropFiles = document.getElementById('dragDropFiles');
const fileInputMedia = document.getElementById('fileInputMedia');
const fileInputFiles = document.getElementById('fileInputFiles');
const chooseMediaBtn = document.getElementById('chooseMediaBtn');
const chooseFilesBtn = document.getElementById('chooseFilesBtn');
const selectedFilesDiv = document.getElementById('selectedFiles');
const chatForm = document.getElementById('chatForm');

function updateSelectedFilesDisplay() {
  if (!selectedFilesDiv) {
    console.error('selectedFilesDiv not found');
    return;
  }
  selectedFilesDiv.innerHTML = '';
  const allFiles = [...selectedMedia, ...selectedFiles];
  if (allFiles.length > 0) {
    selectedFilesDiv.classList.remove('hidden');
    allFiles.forEach((file, index) => {
      const fileDiv = document.createElement('div');
      fileDiv.className = 'flex items-center bg-gray-100 p-2 rounded text-sm';
      fileDiv.innerHTML = `
        <span class="flex-1 truncate">${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
        <button class="ml-2 text-red-500 hover:text-red-700" data-index="${index}" data-type="${selectedMedia.includes(file) ? 'media' : 'files'}">✕</button>
      `;
      selectedFilesDiv.appendChild(fileDiv);
    });

    selectedFilesDiv.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        const type = btn.dataset.type;
        if (type === 'media') {
          selectedMedia.splice(index, 1);
        } else {
          selectedFiles.splice(index - selectedMedia.length, 1);
        }
        updateSelectedFilesDisplay();
      });
    });
  } else {
    selectedFilesDiv.classList.add('hidden');
  }
}

if (dragDropArea && dragDropMedia && dragDropFiles && fileInputMedia && fileInputFiles && chooseMediaBtn && chooseFilesBtn && selectedFilesDiv && chatForm) {
  // Đảm bảo input file nằm trong form
  chatForm.appendChild(fileInputMedia);
  chatForm.appendChild(fileInputFiles);

  let isMediaDragDropVisible = false;
  let isFilesDragDropVisible = false;

  chooseMediaBtn.addEventListener('click', () => {
    console.log('chooseMediaBtn clicked');
    if (isMediaDragDropVisible) {
      // Nhấn lại nút media -> hủy thao tác
      dragDropArea.classList.add('hidden');
      dragDropMedia.classList.add('hidden');
      isMediaDragDropVisible = false;
    } else {
      // Hiển thị vùng kéo thả media
      fileInputMedia.value = ''; // Reset input
      dragDropArea.classList.remove('hidden');
      dragDropMedia.classList.remove('hidden');
      dragDropFiles.classList.add('hidden');
      isMediaDragDropVisible = true;
      isFilesDragDropVisible = false;
      fileInputMedia.click();
    }
  });

  chooseFilesBtn.addEventListener('click', () => {
    console.log('chooseFilesBtn clicked');
    if (isFilesDragDropVisible) {
      // Nhấn lại nút files -> hủy thao tác
      dragDropArea.classList.add('hidden');
      dragDropFiles.classList.add('hidden');
      isFilesDragDropVisible = false;
    } else {
      // Hiển thị vùng kéo thả files
      fileInputFiles.value = ''; // Reset input
      dragDropArea.classList.remove('hidden');
      dragDropFiles.classList.remove('hidden');
      dragDropMedia.classList.add('hidden');
      isFilesDragDropVisible = true;
      isMediaDragDropVisible = false;
      fileInputFiles.click();
    }
  });

  fileInputMedia.addEventListener('change', (e) => {
    console.log('fileInputMedia changed:', Array.from(e.target.files).map(f => ({ name: f.name, type: f.type, size: f.size })));
    handleFiles(e.target.files, 'media');
    dragDropArea.classList.add('hidden');
    dragDropMedia.classList.add('hidden');
    isMediaDragDropVisible = false;
  });

  fileInputFiles.addEventListener('change', (e) => {
    console.log('fileInputFiles changed:', Array.from(e.target.files).map(f => ({ name: f.name, type: f.type, size: f.size })));
    handleFiles(e.target.files, 'files');
    dragDropArea.classList.add('hidden');
    dragDropFiles.classList.add('hidden');
    isFilesDragDropVisible = false;
  });

  dragDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragDropArea.classList.add('bg-gray-100');
  });

  dragDropArea.addEventListener('dragleave', () => {
    dragDropArea.classList.remove('bg-gray-100');
  });

  dragDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDropArea.classList.remove('bg-gray-100');
    console.log('Files dropped:', Array.from(e.dataTransfer.files).map(f => ({ name: f.name, type: f.type, size: f.size })));
    const type = dragDropMedia.classList.contains('hidden') ? 'files' : 'media';
    handleFiles(e.dataTransfer.files, type);
    dragDropArea.classList.add('hidden');
    dragDropMedia.classList.add('hidden');
    dragDropFiles.classList.add('hidden');
    isMediaDragDropVisible = false;
    isFilesDragDropVisible = false;
  });

  function handleFiles(files, type) {
    const maxFiles = 10;
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (selectedMedia.length + selectedFiles.length + files.length > maxFiles) {
      showToast(`Chỉ được chọn tối đa ${maxFiles} file!`);
      return;
    }

    Array.from(files).forEach(file => {
      if (file.size > maxSize) {
        showToast(`File ${file.name} vượt quá 100MB!`);
        return;
      }

      const mediaTypes = /image\/(jpeg|jpg|png)|video\/(mp4|mov)|audio\/(mpeg|wav)/;
      const fileTypes = /application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|zip|x-rar-compressed|rar)/;
      let targetType = type;
      if (type === 'auto') {
        targetType = mediaTypes.test(file.type) ? 'media' : fileTypes.test(file.type) ? 'files' : '';
      }

      if (targetType === 'media' && mediaTypes.test(file.type)) {
        selectedMedia.push(file);
        console.log('Added to selectedMedia:', file.name);
      } else if (targetType === 'files' && fileTypes.test(file.type)) {
        selectedFiles.push(file);
        console.log('Added to selectedFiles:', file);
      } else {
        showToast(`File ${file.name} có định dạng không được hỗ trợ!`);
      }
    });

    updateSelectedFilesDisplay();
  }
} else {
  console.error('Missing DOM elements:', {
    dragDropArea: !!dragDropArea,
    dragDropMedia: !!dragDropMedia,
    dragDropFiles: !!dragDropFiles,
    fileInputMedia: !!fileInputMedia,
    fileInputFiles: !!fileInputFiles,
    chooseMediaBtn: !!chooseMediaBtn,
    chooseFilesBtn: !!chooseFilesBtn,
    selectedFilesDiv: !!selectedFilesDiv,
    chatForm: !!chatForm
  });
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

  selectedMedia = [];
  selectedFiles = [];
  updateSelectedFilesDisplay();

  try {
    const res = await fetch(`/chat/messages/${userId}`, {
      headers: {
        'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      }
    });
    const data = await res.json();
    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML = '';

    if (data.success && data.messages.length > 0) {
      let lastDate = null;
      let lastSenderId = null;

      data.messages.forEach((msg, index) => {
        if (!msg.content && (!msg.files || msg.files.length === 0)) {
          console.warn('Invalid message data:', msg);
          return;
        }

        const isSender = msg.sender._id === currentUserId;
        const currentDate = formatMessageDate(msg.createdAt);

        if (lastDate !== currentDate) {
          const dateDiv = document.createElement('div');
          dateDiv.className = 'text-center my-2';
          dateDiv.innerHTML = `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${currentDate}</span>`;
          chatBox.appendChild(dateDiv);
          lastDate = currentDate;
          lastSenderId = null;
        }

        const showAvatar = !isSender && lastSenderId !== msg.sender._id;
        lastSenderId = msg.sender._id;

        const filesHtml = msg.files && msg.files.length > 0
          ? msg.files.map(file => renderFile(file)).join('')
          : '';

        const contentHtml = msg.content ? `<p>${msg.content}</p>` : '';

        const div = document.createElement('div');
        div.className = `flex ${isSender ? 'justify-end' : 'justify-start'} mb-1`;
        div.dataset.id = msg._id;
        div.dataset.senderId = msg.sender._id;
        div.innerHTML = `
          <div class="flex items-start ${isSender ? 'flex-row-reverse' : ''}">
            ${showAvatar
            ? `<img src="${msg.sender.avatar || '/default-avatar.png'}" alt="Avatar" class="w-8 h-8 rounded-full ${isSender ? 'ml-2' : 'mr-2'}">`
            : isSender ? '' : '<div class="w-8 h-8 mr-2"></div>'
          }
            <div class="inline-block px-3 py-2 rounded ${isSender ? 'bg-blue-200' : 'bg-gray-200'}">
              ${contentHtml}
              ${filesHtml}
              <p class="text-xs text-gray-500">${formatMessageTime(msg.createdAt)}</p>
              ${isSender && msg._id === getLastSeenMessageId(data.messages, currentUserId)
            ? '<p class="text-xs text-gray-500 seen-indicator">Đã xem</p>'
            : ''
          }
            </div>
          </div>
        `;
        chatBox.appendChild(div);
        scrollToBottom();
      });
    }

    socket.emit('chat:read', {
      senderId: userId,
      receiverId: currentUserId
    });

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
      socket.emit('mark_read', { senderId: userId, receiverId: currentUserId, messageIds: unreadIds });
      updateUnreadCount();
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    showToast('Không thể tải tin nhắn');
  }
});

function getLastSeenMessageId(messages, currentUserId) {
  const sentByUser = messages.filter(m => m.sender._id === currentUserId && m.isRead);
  if (sentByUser.length === 0) return null;
  return sentByUser[sentByUser.length - 1]._id;
}

function scrollToBottom() {
  const chatBox = document.getElementById('chatMessages');
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 100);
}

// Đóng modal
document.getElementById('closeChatModal').addEventListener('click', () => {
  document.getElementById('chatModal').classList.add('hidden');
  currentChatUserId = null;
  document.getElementById('typingIndicator').classList.add('hidden');
  selectedMedia = [];
  selectedFiles = [];
  updateSelectedFilesDisplay();
});

let typingTimeout;

document.getElementById('chatInput').addEventListener('input', () => {
  if (!currentChatUserId) return;

  socket.emit('user_typing', {
    userId: currentUserId,
    targetId: currentChatUserId,
    isTyping: true
  });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('user_typing', {
      userId: currentUserId,
      targetId: currentChatUserId,
      isTyping: false
    });
  }, 1000);
});

// Gửi tin nhắn và file
document.getElementById('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  const sendButton = document.querySelector('#chatForm button[type="submit"]');

  // Vô hiệu hóa nút gửi nếu currentChatUserId chưa được thiết lập
  if (!currentChatUserId || !/^[0-9a-fA-F]{24}$/.test(currentChatUserId)) {
    console.error('Invalid receiverId:', currentChatUserId);
    showToast('Vui lòng chọn người nhận trước khi gửi tin nhắn');
    sendButton.disabled = true; // Vô hiệu hóa nút gửi
    return;
  }

  sendButton.disabled = true; // Vô hiệu hóa nút gửi trong khi gửi tin nhắn

  if (!content && selectedMedia.length === 0 && selectedFiles.length === 0) {
    showToast('Phải cung cấp ít nhất nội dung hoặc file');
    sendButton.disabled = false;
    return;
  }

  const formData = new FormData();
  formData.append('content', content);
  formData.append('receiverId', currentChatUserId);
  const csrfToken = document.querySelector('meta[name="csrf-token"]').content || '';
  formData.append('_csrf', csrfToken);
  selectedMedia.forEach(file => {
    formData.append('media', file);
    console.log('Appending media:', file.name);
  });
  selectedFiles.forEach(file => {
    formData.append('files', file);
    console.log('Appending files:', file.name);
  });

  // Debug FormData
  console.log('FormData contents:');
  for (let [key, value] of formData.entries()) {
    console.log(`${key}:`, value.name || value);
  }

  try {
    const response = await fetch('/chat/send', {
      method: 'POST',
      body: formData
    });

    // Kiểm tra response trước khi parse JSON
    const text = await response.text();
    console.log('Raw response:', text);

    let result;
    try {
      result = JSON.parse(text);
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError, 'Response text:', text);
      throw new Error('Server returned invalid JSON');
    }

    if (result.success) {
      input.value = '';
      selectedMedia = [];
      selectedFiles = [];
      updateSelectedFilesDisplay();

      const chatBox = document.getElementById('chatMessages');
      const currentDate = formatMessageDate(new Date());
      let lastDate = null;
      const lastDateDiv = Array.from(chatBox.children)
        .reverse()
        .find(el => el.classList.contains('text-center'));
      if (lastDateDiv && lastDateDiv.querySelector('span')) {
        lastDate = lastDateDiv.querySelector('span').textContent;
      }

      if (lastDate !== currentDate) {
        const dateDiv = document.createElement('div');
        dateDiv.className = 'text-center my-2';
        dateDiv.innerHTML = `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${currentDate}</span>`;
        chatBox.appendChild(dateDiv);
      }

      const div = document.createElement('div');
      div.className = 'flex justify-end mb-1';
      div.dataset.id = result.message._id;
      div.dataset.senderId = currentUserId;
      const filesHtml = result.message.files && result.message.files.length > 0
        ? result.message.files.map(file => renderFile(file)).join('')
        : '';
      const contentHtml = content ? `<p>${content}</p>` : '';
      div.innerHTML = `
        <div class="flex items-start flex-row-reverse">
          <div class="inline-block px-3 py-2 rounded bg-blue-200">
            ${contentHtml}
            ${filesHtml}
            <p class="text-xs text-gray-500">${formatMessageTime(new Date())}</p>
          </div>
        </div>`;
      chatBox.appendChild(div);
      scrollToBottom();

      socket.emit('send_message', {
        senderId: currentUserId,
        receiverId: currentChatUserId,
        content,
        files: result.message.files,
        _id: result.message._id,
        createdAt: result.message.createdAt
      });
    } else {
      showToast('Gửi tin nhắn thất bại: ' + (result.error || 'Lỗi không xác định'));
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('Không thể gửi tin nhắn: ' + error.message);
  } finally {
    sendButton.disabled = false;
  }
});

// Nhận tin nhắn real-time
socket.on('private_message', ({ message, from }) => {
  const chatModal = document.getElementById('chatModal');
  const isCurrentChat = currentChatUserId === message.sender._id || currentChatUserId === message.receiver._id;
  const openedUserId = chatModal.dataset.userId;
  const senderId = message.sender._id;

  if (!chatModal.classList.contains('hidden') && openedUserId === senderId) {
    socket.emit('chat:read', {
      senderId: senderId,
      receiverId: currentUserId
    });
  }

  if (isCurrentChat && !chatModal.classList.contains('hidden')) {
    if (!message.sender || !message.sender.username) {
      console.warn('Invalid message data:', message);
      return;
    }

    const chatBox = document.getElementById('chatMessages');
    const isSender = message.sender._id === currentUserId;
    const currentDate = formatMessageDate(message.createdAt);

    let lastDate = null;
    const lastDateDiv = Array.from(chatBox.children)
      .reverse()
      .find(el => el.classList.contains('text-center'));
    if (lastDateDiv && lastDateDiv.querySelector('span')) {
      lastDate = lastDateDiv.querySelector('span').textContent;
    }

    if (lastDate !== currentDate) {
      const dateDiv = document.createElement('div');
      dateDiv.className = 'text-center my-2';
      dateDiv.innerHTML = `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${currentDate}</span>`;
      chatBox.appendChild(dateDiv);
    }

    const lastSenderId = chatBox.lastElementChild?.dataset.senderId || null;
    const showAvatar = !isSender && lastSenderId !== message.sender._id;

    const filesHtml = message.files && message.files.length > 0
      ? message.files.map(file => renderFile(file)).join('')
      : '';

    const contentHtml = message.content ? `<p>${message.content}</p>` : '';

    const div = document.createElement('div');
    div.className = `flex ${isSender ? 'justify-end' : 'justify-start'} mb-1`;
    div.dataset.id = message._id;
    div.dataset.senderId = message.sender._id;
    div.innerHTML = `
      <div class="flex items-start ${isSender ? 'flex-row-reverse' : ''}">
        ${showAvatar
        ? `<img src="${message.sender.avatar || '/default-avatar.png'}" alt="Avatar" class="w-8 h-8 rounded-full ${isSender ? 'ml-2' : 'mr-2'}">`
        : isSender ? '' : '<div class="w-8 h-8 mr-2"></div>'
      }
        <div class="inline-block px-3 py-2 rounded ${isSender ? 'bg-blue-200' : 'bg-gray-200'}">
          ${contentHtml}
          ${filesHtml}
          <p class="text-xs text-gray-500">${formatMessageTime(message.createdAt)}</p>
          ${isSender && message.isRead ? '<p class="text-xs text-gray-500 seen-indicator">Đã xem</p>' : ''}
        </div>
      </div>
    `;
    chatBox.appendChild(div);
    scrollToBottom();

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
  if (readBy !== currentChatUserId) return;

  const chatBox = document.getElementById('chatMessages');
  if (!Array.isArray(messageIds) || !messageIds.length) {
    console.warn('Invalid or empty messageIds:', messageIds);
    return;
  }

  messageIds.forEach(msgId => {
    const msgDiv = chatBox.querySelector(`div[data-id="${msgId}"]`);
    if (msgDiv && !msgDiv.querySelector('.seen-indicator')) {
      const seenTag = document.createElement('p');
      seenTag.className = 'text-xs text-gray-500 seen-indicator';
      seenTag.textContent = 'Đã xem';
      msgDiv.querySelector('div.inline-block').appendChild(seenTag);
    }
  });
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
      // const totalUnread = Object.values(data.unreadMap).reduce((sum, count) => sum + count, 0);
      // const minimizedUnread = document.getElementById('minimizedUnread');
      // if (minimizedUnread) {
      //   minimizedUnread.textContent = totalUnread;
      //   minimizedUnread.classList.toggle('hidden', totalUnread === 0);
      // }
    }
  } catch (error) {
    console.error('Error updating unread count:', error);
  }
}

document.addEventListener('updateUnreadCount', () => {
  updateUnreadCount();
});

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-center';
  toast.textContent = message;

  // Thêm vào body
  document.body.appendChild(toast);

  // Kích hoạt animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Tự xóa sau 3 giây
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}


document.addEventListener('DOMContentLoaded', () => {
  const chatModal = document.getElementById('chatModal');
  const modalHeader = document.querySelector('.chat-modal-header');

  if (chatModal && modalHeader) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    modalHeader.addEventListener('mousedown', (e) => {
      isDragging = true;

      const rect = chatModal.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      chatModal.style.position = 'fixed';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      e.preventDefault();

      let newX = e.clientX - offsetX;
      let newY = e.clientY - offsetY;

      const modalRect = chatModal.getBoundingClientRect();
      newX = Math.max(0, Math.min(newX, window.innerWidth - modalRect.width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - modalRect.height));

      chatModal.style.left = `${newX}px`;
      chatModal.style.top = `${newY}px`;
      chatModal.style.right = 'auto';
      chatModal.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
});