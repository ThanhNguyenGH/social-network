const socket = io();

socket.emit('join', userId); // userId được inject từ server

document.getElementById('sendBtn').addEventListener('click', () => {
  const content = document.getElementById('messageInput').value;
  if (content) {
    socket.emit('sendMessage', {
      senderId: userId,
      receiverId: document.getElementById('receiverId').value,
      content
    });
    document.getElementById('messageInput').value = '';
  }
});

socket.on('receiveMessage', (message) => {
  const msgDiv = document.createElement('div');
  msgDiv.textContent = `${message.sender.username}: ${message.content}`;
  document.getElementById('chatBox').appendChild(msgDiv);
});

socket.on('notification', (notification) => {
  const notifDiv = document.createElement('div');
  notifDiv.textContent = notification.message;
  document.getElementById('notificationBox').appendChild(notifDiv);
});