const crypto = require('crypto');

const verifyMetaSignature = (req, res, buf) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return;

  const expectedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(buf)
      .digest('hex');

  if (signature !== expectedSignature) {
    throw new Error('Invalid Meta signature');
  }
};

module.exports = verifyMetaSignature;
