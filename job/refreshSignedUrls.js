require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const redisClient = require('../config/redis');
const s3 = require('../config/backblaze');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000); // hết hạn trong 24h tới
    const messages = await Message.find({
      'files.expiresAt': { $lte: threshold }
    });

    for (const message of messages) {
      const updatedFiles = await Promise.all(message.files.map(async (file) => {
        if (file.expiresAt <= threshold) {
          const signedUrl = await s3.getSignedUrlPromise('getObject', {
            Bucket: process.env.B2_BUCKET_NAME,
            Key: file.key,
            Expires: 7 * 24 * 60 * 60 // 7 ngày
          });

          return {
            ...file.toObject(),
            url: signedUrl,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          };
        }
        return file;
      }));

      message.files = updatedFiles;
      await message.save();

      const redisKey = `chat:${[message.sender, message.receiver].sort().join(':')}`;
      await redisClient.del(redisKey);
    }

    console.log('Signed URLs refreshed ✅');
    process.exit(0);
  } catch (err) {
    console.error('❌ Cron job error:', err.stack);
    process.exit(1);
  }
})();
