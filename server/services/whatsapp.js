const axios = require('axios');
const config = require('../config');

const apiUrl = `https://graph.facebook.com/${config.meta.apiVersion}/${config.meta.phoneNumberId}/messages`;

const sendTextMessage = async (toPhoneNumber, messageText) => {
  const response = await axios.post(
    apiUrl,
    {
      messaging_product: 'whatsapp',
      to: toPhoneNumber,
      type: 'text',
      text: { body: messageText },
    },
    {
      headers: {
        Authorization: `Bearer ${config.meta.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

const getMediaUrl = async (mediaId) => {
  const response = await axios.get(
    `https://graph.facebook.com/${config.meta.apiVersion}/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${config.meta.accessToken}` },
    }
  );
  return response.data.url;
};

module.exports = { sendTextMessage, getMediaUrl };
