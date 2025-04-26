# 📦 Database Description

## 📌 Overview

The database is hosted on **MongoDB Atlas**, a cloud-based NoSQL database.  
It consists of the following collections:

- `User`
- `Post`
- `Comment`
- `Message`
- `Notification`

---

## 🧱 Schemas

### 🧑‍💼 User
| Field       | Type              | Description                          |
|-------------|-------------------|--------------------------------------|
| `username`  | String            | Required, unique                     |
| `email`     | String            | Required, unique                     |
| `password`  | String            | Hashed password                      |
| `googleId`  | String            | For Google OAuth                     |
| `avatar`    | String            | Cloudinary image URL                 |
| `bio`       | String            | User biography                       |
| `friends`   | Array of User IDs | List of friend user references       |
| `createdAt` | Date              | Default: now                         |

---

### 📝 Post
| Field       | Type              | Description                          |
|-------------|-------------------|--------------------------------------|
| `user`      | User ID           | Reference to author (required)       |
| `content`   | String            | Required content                     |
| `image`     | String            | Optional Cloudinary image URL        |
| `likes`     | Array of User IDs | List of users who liked the post     |
| `createdAt` | Date              | Default: now                         |

---

### 💬 Comment
| Field       | Type    | Description                  |
|-------------|---------|------------------------------|
| `post`      | Post ID | Reference to the post        |
| `user`      | User ID | Reference to commenter       |
| `content`   | String  | Required                     |
| `createdAt` | Date    | Default: now                 |

---

### 📩 Message
| Field       | Type    | Description                        |
|-------------|---------|------------------------------------|
| `sender`    | User ID | Sender of the message              |
| `receiver`  | User ID | Receiver of the message            |
| `content`   | String  | Message text                       |
| `createdAt` | Date    | Default: now                       |

---

### 🔔 Notification
| Field       | Type    | Description                        |
|-------------|---------|------------------------------------|
| `user`      | User ID | Receiver of the notification       |
| `type`      | String  | Type: `like`, `comment`, `message`|
| `message`   | String  | Notification message               |
| `read`      | Boolean | Default: false                     |
| `createdAt` | Date    | Default: now                       |

---

## 🗺 ERD

📌 *[Include ERD diagram created with draw.io]*

---

## ⚡ Indexes

- **User**:  
  - Index on `username` and `email` → for fast login and search.

- **Post**:  
  - Index on `user` and `createdAt` → for efficient feed sorting.

- **Message**:  
  - Index on `sender` and `receiver` → to optimize chat retrieval.

---

*Last updated: {{YYYY-MM-DD}}*
