// config/backblaze.js
const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
  endpoint: 'https://s3.us-west-004.backblazeb2.com', // nếu chọn region US West
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APPLICATION_KEY,
  signatureVersion: 'v4',
  region: 'us-west-004',
});

module.exports = s3;
