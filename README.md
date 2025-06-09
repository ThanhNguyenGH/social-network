# Social Network

Một ứng dụng mạng xã hội với chat thời gian thực, được xây dựng bằng Node.js, Express, EJS, MongoDB Atlas và Socket.io.

## Features

- Đăng ký, đăng nhập người dùng và xác thực qua Google OAuth.
- Tạo bài đăng, thích, bình luận và chia sẻ bài viết.
- Chat thời gian thực với trạng thái online/offline.
- Thông báo tin nhắn.
- Tìm kiếm người dùng và bài viết.
- Tải ảnh lên qua Cloudinary, files lên Backblaze B2.

## Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: EJS, Tailwind CSS
- **Database**: MongoDB Atlas
- **Storage**: Cloudinary, Backblaze B2
- **Authentication**: express-session, Passport
- **Deployment**: Render

## Installation

1. Clone repository:

   ```bash
   git clone https://github.com/your-username/social-network.git

2. Cài đặt các dependencies:
   npm install

3. Tạo file .env và cấu hình các biến môi trường   (tham khảo file .env.example).

4. Khởi động server:
   npm start

## Deployment

  🔗 [Xem web đã deploy](https://social-network-7ehc.onrender.com)

## License

This project is licensed under the MIT License.  
See the [LICENSE](LICENSE) file for more details.
