const redis = require('redis');
require('dotenv').config();

// Kiểm tra REDIS_URL
if (!process.env.REDIS_URL) {
  console.error('Error: REDIS_URL is not defined in .env');
  process.exit(1);
}

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('Redis connection refused, retrying...');
      return 1000; // Thử lại sau 1 giây
    }
    if (options.total_retry_time > 1000 * 60) {
      console.error('Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      console.error('Max Redis retry attempts reached');
      return new Error('Max retry attempts reached');
    }
    return Math.min(options.attempt * 100, 3000); // Tăng thời gian retry
  }
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('ready', () => console.log('Redis client ready'));

// Kiểm tra session trong Redis
redisClient.on('ready', async () => {
  try {
    const keys = await redisClient.keys('sess:*');
    console.log('Redis sessions:', keys);
  } catch (err) {
    console.error('Error checking Redis sessions:', err);
  }
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    process.exit(1);
  }
})();

module.exports = redisClient;