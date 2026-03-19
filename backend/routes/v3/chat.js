const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const AIRouter = require('../../services/ai/core/AIRouter');
const AICommerceAssistant = require('../../services/ai/AICommerceAssistant');
const ConversationMemoryService = require('../../services/ai/ConversationMemoryService');
const { optionalAuth } = require('../../middleware/auth');

const SESSION_INACTIVITY_RESET_MS = 30 * 60 * 1000;

function createGuestSessionId() {
  return `guest_${crypto.randomBytes(32).toString('hex')}`;
}

function isValidGuestSessionId(value) {
  return typeof value === 'string' && /^guest_[a-f0-9]{64}$/.test(value);
}

function resolveAbsoluteAssetUrl(req, assetPath) {
  if (!assetPath || typeof assetPath !== 'string') {
    return null;
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  const protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
  const host = req.get('host');
  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

  return `${protocol}://${host}${normalizedPath}`;
}

function mapProductForChat(req, product) {
  if (!product || typeof product !== 'object') {
    return null;
  }

  const rawImage = product.images?.[0] || product.image || null;
  const imageUrl = resolveAbsoluteAssetUrl(req, rawImage);
  const id = product._id?.toString?.() || product.id || null;

  return {
    id,
    name: product.name || 'Sản phẩm',
    price: Number(product.price) || 0,
    brand: product.brand || '',
    category: product.category || '',
    imageUrl,
    productUrl: id ? `/product/${id}` : null
  };
}

function extractRetryAfterSeconds(errorMessage = '') {
  if (typeof errorMessage !== 'string') {
    return null;
  }

  const secondsMatch = errorMessage.match(/retry\s+in\s+([\d.]+)s/i);
  if (secondsMatch && Number.isFinite(Number(secondsMatch[1]))) {
    return Math.max(1, Math.ceil(Number(secondsMatch[1])));
  }

  const delayMatch = errorMessage.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (delayMatch && Number.isFinite(Number(delayMatch[1]))) {
    return Math.max(1, Number(delayMatch[1]));
  }

  return null;
}

function classifyAIProviderFailure(errorMessage = '') {
  const text = String(errorMessage || '').toLowerCase();
  const isRateLimit = text.includes('429')
    || text.includes('too many requests')
    || text.includes('quota exceeded')
    || text.includes('rate limit');
  const isCircuitOpen = text.includes('circuit is open');
  const isMissingProviderKey = text.includes('groq_api_key is missing') || text.includes('api key missing');
  const isProviderFailure = text.includes('all providers failed') || isRateLimit || isCircuitOpen || isMissingProviderKey;
  const retryAfterSeconds = isRateLimit ? extractRetryAfterSeconds(errorMessage) : null;

  if (!isProviderFailure) {
    return null;
  }

  return {
    statusCode: isRateLimit ? 503 : 502,
    retryAfterSeconds,
    isMissingProviderKey
  };
}

function getLastUserMessageAt(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item?.role === 'user' && item?.timestamp) {
      const ts = new Date(item.timestamp);
      if (!Number.isNaN(ts.getTime())) {
        return ts;
      }
    }
  }
  return null;
}

router.post('/chat', optionalAuth, async (req, res) => {
  const requestId = `v3_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    console.log(`[${requestId}] [STEP 1] POST /api/v3/chat received`);

    const {
      message,
      sessionId: clientSessionId,
      newChat: newChatRequested = false
    } = req.body || {};
    console.log(`[${requestId}] [STEP 2] payload parsed`, {
      hasMessage: typeof message === 'string',
      messageLength: typeof message === 'string' ? message.length : 0,
      hasClientSessionId: Boolean(clientSessionId),
      newChatRequested: Boolean(newChatRequested),
      clientSessionIdPreview: typeof clientSessionId === 'string' ? clientSessionId.slice(0, 18) : null
    });

    if (!message || typeof message !== 'string' || !message.trim()) {
      console.warn(`[${requestId}] [STEP 2.1] invalid message payload`);
      return res.status(400).json({
        success: false,
        data: {
          text: 'Tin nhắn không hợp lệ. Vui lòng nhập nội dung cần hỏi.',
          sources: []
        }
      });
    }

    const userId = req.user?._id?.toString() || req.user?.id || null;
    console.log(`[${requestId}] [STEP 3] auth resolved`, {
      isAuthenticated: Boolean(userId),
      userId: userId || 'guest'
    });

    // Security-first session policy:
    // - Authenticated users always use server-owned session key by user id.
    // - Guests only reuse strong server-issued guest ids that point to guest conversations.
    let effectiveSessionId = userId ? `user_${userId}` : null;
    console.log(`[${requestId}] [STEP 4] session bootstrap`, {
      mode: userId ? 'user' : 'guest',
      effectiveSessionId
    });

    if (!effectiveSessionId) {
      if (isValidGuestSessionId(clientSessionId)) {
        console.log(`[${requestId}] [STEP 4.1] validating guest session`, {
          clientSessionIdPreview: clientSessionId.slice(0, 18)
        });

        const candidateSession = await ConversationMemoryService.getSession(clientSessionId, {
          includeMessages: false
        });

        console.log(`[${requestId}] [STEP 4.2] guest session lookup done`, {
          success: candidateSession.success,
          hasBoundUser: Boolean(candidateSession.conversation?.user)
        });

        if (candidateSession.success && !candidateSession.conversation?.user) {
          effectiveSessionId = clientSessionId;
        }
      }

      if (!effectiveSessionId) {
        effectiveSessionId = createGuestSessionId();
        console.log(`[${requestId}] [STEP 4.3] generated new guest session`, {
          effectiveSessionIdPreview: effectiveSessionId.slice(0, 18)
        });
      }
    }

    console.log(`[${requestId}] [STEP 5] ensuring session`, {
      effectiveSessionIdPreview: effectiveSessionId.slice(0, 18)
    });
    const ensuredSession = await ConversationMemoryService.ensureSession(effectiveSessionId, userId, {
      channel: 'api_v3_chat'
    });

    if (!ensuredSession.success) {
      throw new Error(ensuredSession.error || 'Không thể khởi tạo hội thoại');
    }
    console.log(`[${requestId}] [STEP 5.1] session ensured`);

    const lastUserMessageAt = getLastUserMessageAt(ensuredSession.conversation);
    const isInactiveTooLong = Boolean(lastUserMessageAt)
      && (Date.now() - lastUserMessageAt.getTime() > SESSION_INACTIVITY_RESET_MS);
    const shouldStartFreshSession = Boolean(newChatRequested) || isInactiveTooLong;

    if (shouldStartFreshSession) {
      console.log(`[${requestId}] [STEP 5.2] resetting session scope`, {
        reason: newChatRequested ? 'new_chat_requested' : 'inactive_over_30m',
        mode: userId ? 'clear_user_memory' : 'rotate_guest_session'
      });

      if (userId) {
        const clearResult = await ConversationMemoryService.clearSessionHistory(effectiveSessionId, {
          reason: newChatRequested ? 'new_chat_requested' : 'inactive_over_30m'
        });

        if (!clearResult.success) {
          throw new Error(clearResult.error || 'Không thể reset phiên chat người dùng');
        }
      } else {
        effectiveSessionId = createGuestSessionId();
        const freshGuestSession = await ConversationMemoryService.ensureSession(effectiveSessionId, userId, {
          channel: 'api_v3_chat',
          refreshedBy: newChatRequested ? 'new_chat_requested' : 'inactive_over_30m'
        });

        if (!freshGuestSession.success) {
          throw new Error(freshGuestSession.error || 'Không thể tạo phiên chat mới cho guest');
        }
      }
    }

    if (!AICommerceAssistant.initialized) {
      console.log(`[${requestId}] [STEP 6] initializing AI assistant`);
      await AICommerceAssistant.initialize();
      console.log(`[${requestId}] [STEP 6.1] AI assistant initialized`);
    }

    console.log(`[${requestId}] [STEP 7] loading conversation history`);
    const historyResult = await ConversationMemoryService.getOptimizedHistory(effectiveSessionId, 4);
    const history = historyResult.success ? historyResult.recentHistory : [];
    const summary = historyResult.success ? historyResult.summary : '';
    const historyForRouter = summary
      ? [{ role: 'system', content: `Ngữ cảnh cũ đã tóm tắt: ${summary}` }, ...history]
      : history;
    console.log(`[${requestId}] [STEP 7.1] history loaded`, {
      historySuccess: historyResult.success,
      historyCount: Array.isArray(history) ? history.length : 0,
      hasSummary: Boolean(summary)
    });

    console.log(`[${requestId}] [STEP 8] routing to AI engine`);
    const aiResult = await AIRouter.routeAndProcess({
      userMessage: message,
      history: historyForRouter,
      sessionId: effectiveSessionId,
      userId
    });

    if (!aiResult || typeof aiResult.text !== 'string') {
      throw new Error('AIRouter.routeAndProcess returned invalid response shape');
    }

    console.log(`[${requestId}] [STEP 8.1] AI engine completed`, {
      hasText: Boolean(aiResult.text),
      textLength: aiResult.text.length,
      sourcesCount: Array.isArray(aiResult.sources) ? aiResult.sources.length : 0
    });

    console.log(`[${requestId}] [STEP 9] saving user message`);
    await ConversationMemoryService.saveMessage(effectiveSessionId, {
      role: 'user',
      content: message,
      metadata: { source: 'api_v3_chat' }
    });
    console.log(`[${requestId}] [STEP 9.1] user message saved`);

    console.log(`[${requestId}] [STEP 10] saving assistant message`);
    await ConversationMemoryService.saveMessage(effectiveSessionId, {
      role: 'assistant',
      content: aiResult.text,
      metadata: {
        source: 'api_v3_chat',
        sources: aiResult.sources || []
      }
    });
    console.log(`[${requestId}] [STEP 10.1] assistant message saved`);

    console.log(`[${requestId}] [STEP 11] sending success response`);

    const routedProducts = Array.isArray(aiResult.raw?.result?.products)
      ? aiResult.raw.result.products
      : [];
    const responseProvider = aiResult.raw?.result?.provider || 'unknown';
    const responseMode = responseProvider === 'local-fallback' ? 'fallback' : 'normal';
    const degraded = responseMode === 'fallback';
    const products = routedProducts
      .map((item) => mapProductForChat(req, item))
      .filter(Boolean)
      .slice(0, 5);

    return res.json({
      success: true,
      sessionId: effectiveSessionId,
      data: {
        text: aiResult.text,
        sources: aiResult.sources || [],
        products,
        meta: {
          provider: responseProvider,
          mode: responseMode,
          degraded
        }
      }
    });
  } catch (error) {
    console.error(`[${requestId}] POST /api/v3/chat error:`, {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });

    const providerFailure = classifyAIProviderFailure(error?.message || '');
    if (providerFailure) {
      if (providerFailure.retryAfterSeconds) {
        res.set('Retry-After', String(providerFailure.retryAfterSeconds));
      }

      return res.status(providerFailure.statusCode).json({
        success: false,
        debugId: requestId,
        data: {
          text: providerFailure.isMissingProviderKey
            ? 'AI chưa được cấu hình API key cho router. Hệ thống đang chạy chế độ dự phòng, vui lòng thử lại sau hoặc cấu hình GROQ_API_KEY.'
            : providerFailure.retryAfterSeconds
              ? `AI đang quá tải hoặc chạm giới hạn quota. Vui lòng thử lại sau khoảng ${providerFailure.retryAfterSeconds} giây.`
              : 'AI đang quá tải hoặc tạm thời không khả dụng. Vui lòng thử lại sau vài giây.',
          sources: [],
          meta: {
            provider: providerFailure.isMissingProviderKey ? 'local-fallback' : 'provider-error',
            mode: 'fallback',
            degraded: true
          }
        }
      });
    }

    return res.status(500).json({
      success: false,
      debugId: requestId,
      data: {
        text: 'Hệ thống AI đang bận hoặc gặp lỗi tạm thời. Vui lòng thử lại sau vài giây.',
        sources: []
      }
    });
  }
});

module.exports = router;
