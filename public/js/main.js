document.addEventListener('DOMContentLoaded', () => {
  const csrfToken = document.querySelector('input[name="_csrf"]').value;
  const userId = document.querySelector('input[name="userId"]').value;

  const socket = io();

  socket.on('connect', () => console.log('Socket.IO connected:', socket.id));
  socket.on('newComment', (data) => handleNewComment(data.postId, data.comment));
  socket.on('updatedComment', (data) => handleUpdatedComment(data.postId, data.comment));
  socket.on('deletedComment', (data) => handleDeletedComment(data.postId, data.commentId));
  socket.on('disconnect', () => console.log('Socket.IO disconnected'));
  socket.on('connect_error', (err) => console.error('Socket.IO connection error:', err.message));

  function handleNewComment(postId, comment) {
    try {
      const commentList = document.getElementById(`comment-list-${postId}`);
      const commentCount = document.getElementById(`comment-count-${postId}`);
      const commentSection = document.getElementById(`comment-section-${postId}`);
      if (!commentList || !commentCount || commentSection.classList.contains('hidden')) return;
      const commentDiv = createCommentElement(comment);
      commentList.prepend(commentDiv);
      updateCommentCount(postId, 1);
      if (commentList.querySelector('.text-gray-500')) {
        commentList.innerHTML = '';
        commentList.appendChild(commentDiv);
      }
    } catch (error) {
      console.error('Error handling new comment:', error);
    }
  }

  function handleUpdatedComment(postId, comment) {
    try {
      const commentDiv = document.getElementById(`comment-${comment._id}`);
      if (commentDiv) {
        const contentPara = commentDiv.querySelector('.comment-content');
        contentPara.textContent = comment.content;
        if (comment.updatedAt && new Date(comment.updatedAt) > new Date(comment.createdAt)) {
          const editLabel = commentDiv.querySelector('.edit-label') || document.createElement('span');
          editLabel.className = 'edit-label text-gray-400 text-sm ml-2';
          editLabel.textContent = '(Đã chỉnh sửa)';
          if (!commentDiv.querySelector('.edit-label')) {
            contentPara.parentNode.insertBefore(editLabel, contentPara.nextSibling);
          }
        }
      }
    } catch (error) {
      console.error('Error handling updated comment:', error);
    }
  }

  function handleDeletedComment(postId, commentId) {
    try {
      const commentDiv = document.getElementById(`comment-${commentId}`);
      if (commentDiv) {
        commentDiv.remove();
        updateCommentCount(postId, -1);
        const commentList = document.getElementById(`comment-list-${postId}`);
        if (commentList.children.length === 0) {
          commentList.innerHTML = '<p class="text-gray-500">Chưa có bình luận nào.</p>';
        }
      }
    } catch (error) {
      console.error('Error handling deleted comment:', error);
    }
  }

  function createCommentElement(comment) {
    const commentDiv = document.createElement('div');
    commentDiv.id = `comment-${comment._id}`;
    commentDiv.className = 'mb-2';

    // Xử lý thiếu thông tin user (do user bị xóa)
    const author = comment.author || {
      _id: 'unknown',
      username: '[Người dùng đã xóa]',
      avatar: '/images/default-avatar.png'
    };

    const isOwnComment = author._id === userId;
    const createdAt = new Date(comment.createdAt);
    const now = new Date();
    const canEdit = isOwnComment && (now - createdAt) < 5 * 60 * 1000;

    commentDiv.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <a href="${author._id !== 'unknown' ? `/users/profile/${author._id}` : '#'}" class="flex items-center">
          <img src="${author.avatar}" alt="Avatar" class="w-8 h-8 rounded-full mr-2">
          <p class="font-semibold hover:text-blue-500">${author.username}</p>
        </a>
      </div>
      ${isOwnComment ? `
        <div class="flex space-x-2">
          ${canEdit ? `
            <button class="edit-comment-btn text-blue-500 hover:text-blue-700" data-comment-id="${comment._id}">
              <i class="fas fa-edit"></i>
            </button>
          ` : ''}
          <button class="delete-comment-btn text-red-500 hover:text-red-700" data-comment-id="${comment._id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      ` : ''}
    </div>
    <p class="text-gray-600 comment-content">${comment.content}</p>
    ${comment.updatedAt && new Date(comment.updatedAt) > new Date(comment.createdAt) ? `
      <span class="edit-label text-gray-400 text-sm ml-2">(Đã chỉnh sửa)</span>
    ` : ''}
    <p class="text-gray-400 text-sm">${createdAt.toLocaleString()}</p>
  `;

    if (isOwnComment) attachCommentActions(commentDiv, comment._id, canEdit);
    return commentDiv;
  }


  function updateCommentCount(postId, delta) {
    const commentCount = document.getElementById(`comment-count-${postId}`);
    if (commentCount) {
      const currentCount = parseInt(commentCount.textContent) || 0;
      commentCount.textContent = `${currentCount + delta} Bình luận`;
    }
  }

  function attachCommentActions(commentDiv, commentId, canEdit) {
    const editBtn = commentDiv.querySelector('.edit-comment-btn');
    const deleteBtn = commentDiv.querySelector('.delete-comment-btn');

    if (editBtn && canEdit) {
      editBtn.addEventListener('click', () => {
        const contentPara = commentDiv.querySelector('.comment-content');
        const originalContent = contentPara.textContent;
        const editForm = document.createElement('div');
        editForm.innerHTML = `
          <textarea class="w-full p-2 border rounded" rows="2">${originalContent}</textarea>
          <div class="flex space-x-2 mt-2">
            <button class="save-comment-btn bg-blue-500 text-white px-2 py-1 rounded">Lưu</button>
            <button class="cancel-edit-btn bg-gray-500 text-white px-2 py-1 rounded">Hủy</button>
          </div>
        `;
        contentPara.replaceWith(editForm);

        const saveBtn = editForm.querySelector('.save-comment-btn');
        const cancelBtn = editForm.querySelector('.cancel-edit-btn');
        const textarea = editForm.querySelector('textarea');

        saveBtn.addEventListener('click', async () => {
          const newContent = textarea.value.trim();
          if (!newContent || newContent.length > 500) {
            alert('Bình luận phải từ 1 đến 500 ký tự.');
            return;
          }
          try {
            const response = await fetch(`/comments/${commentId}/edit`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `_csrf=${encodeURIComponent(csrfToken)}&content=${encodeURIComponent(newContent)}`
            });
            const data = await response.json();
            if (!response.ok || data.error) {
              throw new Error(data.error || `HTTP error! Status: ${response.status}`);
            }
            editForm.replaceWith(contentPara);
            contentPara.textContent = newContent;
          } catch (error) {
            console.error('Error editing comment:', error);
            alert(error.message || 'Không thể sửa bình luận. Vui lòng thử lại.');
          }
        });

        cancelBtn.addEventListener('click', () => {
          editForm.replaceWith(contentPara);
        });
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Bạn có chắc muốn xóa bình luận này?')) return;
        try {
          const response = await fetch(`/comments/${commentId}/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `_csrf=${encodeURIComponent(csrfToken)}`
          });
          const data = await response.json();
          if (!response.ok || data.error) {
            throw new Error(data.error || `HTTP error! Status: ${response.status}`);
          }
        } catch (error) {
          console.error('Error deleting comment:', error);
          alert(error.message || 'Không thể xóa bình luận. Vui lòng thử lại.');
        }
      });
    }
  }

  async function fetchComments(postId) {
  try {
    const response = await fetch(`/comments/${postId}`);
    if (!response.ok) {
      console.error(`HTTP error! Status: ${response.status}`);
      throw new Error(`Không thể lấy dữ liệu từ server`);
    }

    const data = await response.json();
    const commentList = document.getElementById(`comment-list-${postId}`);
    if (!commentList) {
      console.warn(`Không tìm thấy phần tử comment-list-${postId}`);
      return;
    }

    // Xóa nội dung cũ
    commentList.innerHTML = '';

    if (data.comments.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'text-gray-500';
      emptyMessage.textContent = 'Chưa có bình luận nào.';
      commentList.appendChild(emptyMessage);
    } else {
      data.comments.forEach(comment => {
        const commentElement = createCommentElement(comment);
        commentList.appendChild(commentElement);
      });
    }
  } catch (error) {
    console.error('Lỗi khi tải bình luận:', error);
    alert('Không thể tải bình luận. Vui lòng thử lại sau.');
  }
}


  function attachCommentToggleEvent(button) {
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    newButton.addEventListener('click', () => {
      const postId = newButton.dataset.postId;
      const commentSection = document.getElementById(`comment-section-${postId}`);
      if (!commentSection) return;
      if (commentSection.classList.contains('hidden')) {
        fetchComments(postId);
        socket.emit('subscribe', postId);
      } else {
        socket.emit('unsubscribe', postId);
      }
      commentSection.classList.toggle('hidden');
    });
  }

  function attachCommentFormEvent(form) {
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    let isSubmitting = false;
    newForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (isSubmitting) return;
      isSubmitting = true;
      const postId = newForm.dataset.postId;
      const content = newForm.querySelector('textarea[name="content"]').value;
      const submitButton = newForm.querySelector('button[type="submit"]');
      if (!csrfToken) {
        alert('Thiếu CSRF Token. Vui lòng làm mới trang.');
        isSubmitting = false;
        return;
      }
      submitButton.disabled = true;
      try {
        const response = await fetch('/comments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `_csrf=${encodeURIComponent(csrfToken)}&postId=${encodeURIComponent(postId)}&content=${encodeURIComponent(content)}`
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || `HTTP error! Status: ${response.status}`);
        }
        newForm.querySelector('textarea').value = '';
      } catch (error) {
        alert(error.message === 'Please wait a few seconds before commenting again.'
          ? 'Vui lòng đợi vài giây trước khi gửi bình luận tiếp theo.'
          : error.message || 'Không thể gửi bình luận. Vui lòng thử lại.');
      } finally {
        submitButton.disabled = false;
        isSubmitting = false;
      }
    });
  }

  document.querySelectorAll('.comment-toggle-btn').forEach(attachCommentToggleEvent);
  document.querySelectorAll('.comment-form').forEach(attachCommentFormEvent);

  document.querySelectorAll('.like-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const postId = button.dataset.postId;
      if (!csrfToken) {
        alert('Thiếu CSRF Token. Vui lòng làm mới trang.');
        return;
      }
      try {
        const response = await fetch(`/post/${postId}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `_csrf=${encodeURIComponent(csrfToken)}`
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || `HTTP error! Status: ${response.status}`);
        }
        const likeCount = document.getElementById(`like-count-${postId}`);
        const heartIcon = button.querySelector('i');
        if (likeCount && heartIcon) {
          likeCount.textContent = `${data.likes} Thích`;
          heartIcon.classList.toggle('text-blue-500', data.liked);
          heartIcon.classList.toggle('text-gray-500', !data.liked);
        }
      } catch (error) {
        alert('Không thể thích bài đăng. Vui lòng thử lại.');
      }
    });
  });

  let page = 1;
  let isLoading = false;
  let hasMorePosts = true;

  window.addEventListener('scroll', async () => {
    const postsContainer = document.getElementById('posts-container');
    const loadingDiv = document.getElementById('loading');
    const noMorePostsDiv = document.getElementById('no-more-posts');

    if (
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
      !isLoading &&
      hasMorePosts
    ) {
      isLoading = true;
      loadingDiv.classList.remove('hidden');

      try {
        const response = await fetch(`/loadMorePosts?page=${page + 1}`);
        const data = await response.text();

        if (response.ok && data.trim()) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data;
          const newPosts = tempDiv.querySelectorAll('.post');

          newPosts.forEach(post => postsContainer.appendChild(post));

          // Gắn lại các sự kiện cho bài viết mới
          document.querySelectorAll('.comment-toggle-btn').forEach(attachCommentToggleEvent);
          document.querySelectorAll('.comment-form').forEach(attachCommentFormEvent);
          document.querySelectorAll('.like-btn').forEach(button => {
            button.addEventListener('click', async () => {
              const postId = button.dataset.postId;
              if (!csrfToken) {
                alert('Thiếu CSRF Token. Vui lòng làm mới trang.');
                return;
              }
              try {
                const response = await fetch(`/post/${postId}/like`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: `_csrf=${encodeURIComponent(csrfToken)}`
                });
                const data = await response.json();
                if (!response.ok || data.error) {
                  throw new Error(data.error || `HTTP error! Status: ${response.status}`);
                }
                const likeCount = document.getElementById(`like-count-${postId}`);
                const heartIcon = button.querySelector('i');
                if (likeCount && heartIcon) {
                  likeCount.textContent = `${data.likes} Thích`;
                  heartIcon.classList.toggle('text-blue-500', data.liked);
                  heartIcon.classList.toggle('text-gray-500', !data.liked);
                }
              } catch (error) {
                alert('Không thể thích bài đăng. Vui lòng thử lại.');
              }
            });
          });

          page++;
        } else {
          hasMorePosts = false;
          noMorePostsDiv.classList.remove('hidden');
        }
      } catch (error) {
        console.error('Error loading more posts:', error);
      } finally {
        loadingDiv.classList.add('hidden');
        isLoading = false;
      }
    }
  });
});
