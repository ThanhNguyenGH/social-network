// chat.js

// Variables
let currentChatUserId = null;
let currentUserId = document.body.dataset.userId || window.currentUserId;
let selectedMedia = [];
let selectedFiles = [];
let typingTimeout;

// Socket connection
const socket = io();
if (currentUserId) {
    socket.emit('auth', currentUserId);
}

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const chatForm = document.getElementById('chatForm');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const filePreview = document.getElementById('filePreview');
const selectedFilesDiv = document.getElementById('selectedFiles');
const dragDropArea = document.getElementById('dragDropArea');
const fileInputMedia = document.getElementById('fileInputMedia');
const fileInputFiles = document.getElementById('fileInputFiles');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const clearFilesBtn = document.getElementById('clearFilesBtn');

// Utility Functions
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function scrollToBottom() {
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-4 bg-blue-600 text-white p-3 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// File Functions
function renderFile(file) {
    if (file.mimeType.startsWith('image/')) {
        return `<img src="${file.url}" alt="${file.name}" class="max-w-xs h-auto rounded mt-2 cursor-pointer" onclick="openImageModal('${file.url}')">`;
    } else if (file.mimeType.startsWith('video/')) {
        return `
            <video controls class="max-w-xs h-auto rounded mt-2">
                <source src="${file.url}" type="${file.mimeType}">
                Trình duyệt không hỗ trợ phát video.
            </video>`;
    } else if (file.mimeType.startsWith('audio/')) {
        return `<audio src="${file.url}" controls class="mt-2 w-full max-w-xs"></audio>`;
    } else {
        return `<a href="${file.url}" target="_blank" class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mt-2 p-2 bg-blue-50 rounded">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
            </svg>
            ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)
        </a>`;
    }
}

function updateFilePreview() {
    const allFiles = [...selectedMedia, ...selectedFiles];
    
    if (allFiles.length > 0) {
        filePreview.classList.remove('hidden');
        selectedFilesDiv.innerHTML = '';
        
        allFiles.forEach((file, index) => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file-item';
            fileDiv.innerHTML = `
                <div class="file-info">
                    <div class="file-icon">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                        </svg>
                    </div>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                </div>
                <button class="remove-file" onclick="removeFile(${index})" data-index="${index}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            `;
            selectedFilesDiv.appendChild(fileDiv);
        });
    } else {
        filePreview.classList.add('hidden');
    }
}

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
        const fileTypes = /application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|zip|rar|x-rar-compressed)/;
        
        let targetType = type;
        if (type === 'auto') {
            targetType = mediaTypes.test(file.type) ? 'media' : fileTypes.test(file.type) ? 'files' : '';
        }
        
        if (targetType === 'media' && mediaTypes.test(file.type)) {
            selectedMedia.push(file);
        } else if (targetType === 'files' && fileTypes.test(file.type)) {
            selectedFiles.push(file);
        } else {
            showToast(`File ${file.name} có định dạng không được hỗ trợ!`);
        }
    });
    
    updateFilePreview();
}

function removeFile(index) {
    const allFiles = [...selectedMedia, ...selectedFiles];
    const file = allFiles[index];
    
    if (selectedMedia.includes(file)) {
        selectedMedia.splice(selectedMedia.indexOf(file), 1);
    } else {
        selectedFiles.splice(selectedFiles.indexOf(file), 1);
    }
    
    updateFilePreview();
}

function clearFiles() {
    selectedMedia = [];
    selectedFiles = [];
    updateFilePreview();
}

// Message Functions
function addMessage(message, isOwn = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'message-sent' : 'message-received'}`;
    messageDiv.dataset.id = message._id;
    
    const filesHtml = message.files && message.files.length > 0
        ? message.files.map(file => renderFile(file)).join('')
        : '';
    
    const contentHtml = message.content ? `<p>${message.content}</p>` : '';
    
    messageDiv.innerHTML = `
        <div class="message-bubble ${isOwn ? 'sent' : 'received'}">
            ${contentHtml}
            ${filesHtml}
            <div class="message-time">
                ${formatMessageTime(message.createdAt)}
                ${isOwn && message.isRead ? '<span class="text-xs ml-1">✓</span>' : ''}
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addDateSeparator(date) {
    const dateDiv = document.createElement('div');
    dateDiv.className = 'date-separator';
    dateDiv.innerHTML = `<span>${date}</span>`;
    chatMessages.appendChild(dateDiv);
}

// Chat Functions
async function loadMessages(userId) {
    try {
        const res = await fetch(`/chat/messages/${userId}`, {
            headers: {
                'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
            }
        });
        
        const data = await res.json();
        chatMessages.innerHTML = '';
        
        if (data.success && data.messages.length > 0) {
            let lastDate = null;
            
            data.messages.forEach(msg => {
                const currentDate = formatMessageDate(msg.createdAt);
                
                if (lastDate !== currentDate) {
                    addDateSeparator(currentDate);
                    lastDate = currentDate;
                }
                
                const isSender = msg.sender._id === currentUserId;
                addMessage(msg, isSender);
            });
            
            // Mark messages as read
            const unreadIds = data.messages
                .filter(msg => !msg.isRead && msg.receiver && msg.receiver._id === currentUserId)
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
            }
        } else {
            chatMessages.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-gray-400 text-sm">
                        <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                        <p>Chưa có tin nhắn nào</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        showToast('Không thể tải tin nhắn');
    }
}

// Event Listeners
document.addEventListener('openChatModal', async (event) => {
    const { userId, username, avatar } = event.detail;
    
    currentChatUserId = userId;
    document.getElementById('chatUsername').textContent = username;
    document.getElementById('chatAvatar').src = avatar || '/default-avatar.png';
    document.getElementById('chatStatus').textContent = 'Online';
    
    clearFiles();
    await loadMessages(userId);
});

// Message Input
messageInput.addEventListener('input', () => {
    // Auto-resize textarea
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 96) + 'px';
    
    // Typing indicator
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
    }, 3000);
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Send Message
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const content = messageInput.value.trim();
    
    if (!currentChatUserId) {
        showToast('Vui lòng chọn người để trò chuyện');
        return;
    }
    
    if (!content && selectedMedia.length === 0 && selectedFiles.length === 0) {
        showToast('Vui lòng nhập tin nhắn hoặc chọn file');
        return;
    }
    
    sendButton.disabled = true;
    
    const formData = new FormData();
    formData.append('content', content);
    formData.append('receiverId', currentChatUserId);
    formData.append('_csrf', document.querySelector('meta[name="csrf-token"]').content);
    
    selectedMedia.forEach(file => formData.append('media', file));
    selectedFiles.forEach(file => formData.append('files', file));
})