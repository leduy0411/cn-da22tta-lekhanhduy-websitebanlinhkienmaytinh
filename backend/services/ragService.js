/**
 * RAG Service
 * ───────────────────────────────────────────────────────────────
 * Wraps calls to the Python AI microservice for RAG-based chat.
 *
 * Responsibilities:
 *   • chatWithIntent()  — send a message, get intent + answer + products
 *   • detectIntent()    — classify intent only (for debugging / routing)
 *   • priceSearch()     — MongoDB direct price lookup (local fallback)
 *
 * The Python AI service handles:
 *   knowledge_question  → pure Gemini answer
 *   product_search      → FAISS RAG + Gemini
 *   product_price       → MongoDB text search + Gemini
 */

const axios = require('axios');
const Product = require('../models/Product');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT_MS     = parseInt(process.env.AI_SERVICE_TIMEOUT) || 15000;

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Intent constants (mirrors ai-service/services/intent_service.py) ──────
const INTENT = {
  KNOWLEDGE: 'knowledge_question',
  PRODUCT:   'product_search',
  PRICE:     'product_price',
};

// ─── Availability cache ─────────────────────────────────────────────────────
let _available   = null;
let _lastCheck   = 0;
const CHECK_TTL  = 30_000;

async function _isAvailable() {
  const now = Date.now();
  if (_available !== null && now - _lastCheck < CHECK_TTL) return _available;
  try {
    const res = await aiClient.get('/health', { timeout: 2500 });
    _available = res.data?.status === 'ok' || res.data?.status === 'healthy';
  } catch {
    _available = false;
  }
  _lastCheck = now;
  return _available;
}

// ─── Format VND price ───────────────────────────────────────────────────────
function _formatPrice(price) {
  if (price == null || isNaN(price)) return 'Liên hệ';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND'
  }).format(price);
}

// ─── Local price fallback ───────────────────────────────────────────────────
/**
 * MongoDB text-search for price lookup when AI service is unavailable.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<{answer: string, products: object[], source: string}>}
 */
async function _localPriceSearch(query, limit = 5) {
  const products = await Product.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();

  if (!products.length) {
    // Regex fallback
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const fallback = await Product.find({
      $or: [{ name: pattern }, { brand: pattern }],
    })
      .limit(limit)
      .lean();
    products.push(...fallback);
  }

  if (!products.length) {
    return {
      answer: `Không tìm thấy sản phẩm nào khớp với "${query}" trong cơ sở dữ liệu.`,
      products: [],
      source: 'local_price_fallback',
    };
  }

  const lines = products.map((p) => {
    const stock = (p.stock || 0) > 0 ? 'Còn hàng' : 'Hết hàng';
    return `• **${p.name}** (${p.brand || 'N/A'}): ${_formatPrice(p.price)} — ${stock}`;
  });

  return {
    answer: `Thông tin giá sản phẩm:\n\n${lines.join('\n')}`,
    products,
    source: 'local_price_fallback',
  };
}

// ─── Local product-search fallback ─────────────────────────────────────────
/**
 * Plain MongoDB full-text search fallback for product queries.
 */
async function _localProductSearch(query, limit = 5) {
  const products = await Product.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();

  if (!products.length) {
    return {
      answer: `Xin lỗi, hiện tại dịch vụ AI đang bảo trì. Bạn có thể tìm kiếm "${query}" trong danh mục sản phẩm.`,
      products: [],
      source: 'local_search_fallback',
    };
  }

  const names = products.slice(0, 3).map((p) => `**${p.name}**`).join(', ');
  return {
    answer: `Tôi tìm thấy ${products.length} sản phẩm liên quan: ${names}. Vui lòng xem chi tiết bên dưới.`,
    products,
    source: 'local_search_fallback',
  };
}

// ═══════════════════════════════════════════════════════════════════════════ //
//  Public API                                                                 //
// ═══════════════════════════════════════════════════════════════════════════ //

/**
 * Send a chat message — auto-detects intent, returns answer + products.
 *
 * @param {string} message  User's question
 * @param {object} options
 * @param {number} [options.topK=5]  Max products to retrieve
 * @returns {Promise<{
 *   success: boolean,
 *   intent: string,
 *   answer: string,
 *   products: object[],
 *   source: string
 * }>}
 */
async function chatWithIntent(message, { topK = 5 } = {}) {
  const ok = await _isAvailable();

  if (ok) {
    try {
      const res = await aiClient.post('/chat', {
        message,
        top_k: topK,
      });

      const data = res.data;
      return {
        success: true,
        intent:   data.intent  || INTENT.PRODUCT,
        answer:   data.answer  || '',
        products: data.retrieved_products || [],
        source:   data.source  || 'ai_service',
      };
    } catch (err) {
      console.error('[ragService] AI service chat error:', err.message);
      // Fall through to local fallback
    }
  }

  // ── Local fallback when AI service is down ──────────────────────────────
  console.warn('[ragService] AI service unavailable — using local fallback');

  // Simple regex-based intent for the fallback path
  const pricePattern = /(giá|bao nhiêu|price|cost|tiền|tồn kho|còn hàng)/i;
  const localIntent  = pricePattern.test(message) ? INTENT.PRICE : INTENT.PRODUCT;

  const fallback = localIntent === INTENT.PRICE
    ? await _localPriceSearch(message, topK)
    : await _localProductSearch(message, topK);

  return {
    success: true,
    intent:   localIntent,
    answer:   fallback.answer,
    products: fallback.products,
    source:   fallback.source,
  };
}

/**
 * Detect intent only — lightweight call for debugging.
 *
 * @param {string} message
 * @returns {Promise<string>} intent label
 */
async function detectIntent(message) {
  try {
    const res = await aiClient.post('/chat/intent', { message });
    return res.data?.intent || INTENT.KNOWLEDGE;
  } catch {
    return INTENT.KNOWLEDGE;
  }
}

module.exports = { chatWithIntent, detectIntent, INTENT };
