import api from './client';

export const getConversations = () => api.get('/conversations').then(r => r.data);
export const getConversation = (id) => api.get(`/conversations/${id}`).then(r => r.data);
export const updateConversation = (id, data) => api.patch(`/conversations/${id}`, data).then(r => r.data);
export const getMessages = (id) => api.get(`/conversations/${id}/messages`).then(r => r.data);
export const sendMessage = (id, text) => api.post(`/conversations/${id}/messages`, { text }).then(r => r.data);
