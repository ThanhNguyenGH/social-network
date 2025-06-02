const { createClient } = require('redis');
require('dotenv').config();

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  name: 'chat-app',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Max retry attempts reached');
      const delay = Math.min(retries * 100, 3000);
      console.log(`Retrying Redis connection (attempt ${retries + 1}) after ${delay}ms`);
      return delay;
    }
  }
});

redisClient.on('error', err => console.error('Redis error:', err));
redisClient.on('connect', () => console.log('Redis connected'));
redisClient.on('ready', () => console.log('Redis ready'));
redisClient.on('end', () => console.log('Redis connection closed'));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Redis connect failed:', err);
  }
})();

module.exports = redisClient;
