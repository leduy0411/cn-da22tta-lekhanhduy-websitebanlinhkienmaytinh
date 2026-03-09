/**
 * ragAPI.js
 * ─────────────────────────────────────────────────────────
 * Axios helpers for the RAG chatbot endpoints.
 *
 * All calls go through the shared `api` Axios instance so the
 * Authorization header and session-id interceptor are included
 * automatically.
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL });

// Attach Bearer token if present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ────────────────────────────────────────────────────────────────────────── //

/**
 * Send a chat message to the RAG chatbot.
 *
 * @param {string} message  User's question
 * @param {number} [topK=5] Number of products to retrieve
 * @returns {Promise<{
 *   success: boolean,
 *   intent: 'knowledge_question'|'product_search'|'product_price',
 *   answer: string,
 *   products: object[],
 *   source: string
 * }>}
 */
export async function sendRAGMessage(message, topK = 5) {
  const res = await api.post('/chat', { message, topK });
  return res.data;
}

/**
 * Detect intent only — no answer generated (useful for debugging).
 *
 * @param {string} message
 * @returns {Promise<{success: boolean, intent: string, message: string}>}
 */
export async function detectIntent(message) {
  const res = await api.post('/chat/detect-intent', { message });
  return res.data;
}

const ragAPI = { sendRAGMessage, detectIntent };
export default ragAPI;
