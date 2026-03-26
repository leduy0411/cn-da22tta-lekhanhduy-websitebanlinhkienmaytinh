/**
 * Unified AI Router
 * Single flow for every message:
 * user_message -> Gemini native multimodal tool calling -> frontend response
 */

const crypto = require('crypto');
const GeminiChatService = require('../../GeminiChatService');

class AIRouter {
  constructor() {
    this.agents = new Map();
    this.routingLogs = [];
    this.maxLogSize = 500;
    this.responseCache = new Map();
    this.cacheTtlMs = Number(process.env.AI_RESPONSE_CACHE_TTL_MS || 30000);
    this.cacheEnabled = String(process.env.AI_RESPONSE_CACHE_ENABLED || 'false').toLowerCase() === 'true';
  }

  registerAgent(name, agent) {
    if (!agent || typeof agent.execute !== 'function') {
      throw new Error('Agent must expose execute()');
    }

    this.agents.set(name, {
      name,
      agent,
      registeredAt: new Date()
    });
  }

  listAgents() {
    return Array.from(this.agents.keys());
  }

  async route(message, context = {}) {
    const routingId = this._generateRoutingId();
    const startedAt = Date.now();

    try {
      const result = await this._handleUnifiedFlow(message, context);
      const executionTime = Date.now() - startedAt;

      this._logRouting({
        routingId,
        message,
        intent: 'unified_direct',
        executionTime,
        success: true,
        timestamp: new Date()
      });

      return {
        success: true,
        routingId,
        intent: 'unified_direct',
        confidence: 1,
        agent: 'UnifiedRAGRouter',
        result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startedAt;

      this._logRouting({
        routingId,
        message,
        error: error.message,
        executionTime,
        success: false,
        timestamp: new Date()
      });

      return {
        success: false,
        routingId,
        error: error.message,
        executionTime
      };
    }
  }

  async routeAndProcess(params = {}) {
    const {
      userMessage = '',
      imageBase64 = undefined,
      history = [],
      sessionId = null,
      userId = null
    } = params;

    const routed = await this.route(userMessage, {
      sessionId,
      userId,
      imageBase64,
      conversationHistory: Array.isArray(history) ? history : []
    });

    if (!routed.success) {
      throw new Error(routed.error || 'AI processing failed');
    }

    if (!routed.result || typeof routed.result.answer !== 'string' || !routed.result.answer.trim()) {
      throw new Error('Unified flow returned invalid answer');
    }

    return {
      text: routed.result.answer,
      sources: Array.isArray(routed.result.sources) ? routed.result.sources : [],
      raw: routed
    };
  }

  async routeStreaming(message, context = {}, onChunk) {
    const routed = await this.route(message, context);
    if (!routed.success) {
      onChunk?.({
        type: 'error',
        data: { error: routed.error || 'AI processing failed' }
      });
      throw new Error(routed.error || 'AI processing failed');
    }

    onChunk?.({
      type: 'result',
      data: routed.result
    });

    return routed.result;
  }

  _logUnifiedFlowDebug({ userMessage = '', masterContext = '', finalPrompt = [] }) {
    const color = {
      reset: '\x1b[0m',
      cyan: '\x1b[36m',
      yellow: '\x1b[33m',
      magenta: '\x1b[35m',
      green: '\x1b[32m'
    };

    const safeStringify = (value) => {
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return `[UNSERIALIZABLE_PAYLOAD] ${error?.message || 'unknown error'}`;
      }
    };

    console.log(`${color.cyan}\n================== AIRouter UNIFIED DEBUG ==================${color.reset}`);
    console.log(`${color.yellow}USER_MESSAGE:${color.reset}\n${String(userMessage || '')}`);
    console.log(`${color.magenta}MASTER_CONTEXT:${color.reset}\n${String(masterContext || '')}`);
    console.log(`${color.green}FINAL_PROMPT:${color.reset}\n${safeStringify(finalPrompt)}`);
    console.log(`${color.cyan}=============================================================\n${color.reset}`);
  }

  async _handleUnifiedFlow(userMessage, context = {}) {
    const normalizedMessage = String(userMessage || '').trim();
    const conversationHistory = Array.isArray(context.conversationHistory) ? context.conversationHistory : [];
    const imageBase64 = typeof context?.imageBase64 === 'string' ? context.imageBase64.trim() : '';
    const sessionKey = String(context?.sessionId || 'anonymous');
    const imageHash = imageBase64
      ? crypto.createHash('sha1').update(imageBase64).digest('hex').slice(0, 24)
      : 'none';
    const imageKey = `::img:${imageHash}`;
    const cacheKey = `${sessionKey}::${normalizedMessage.toLowerCase()}${imageKey}`;

    if (this.cacheEnabled) {
      const cached = this.responseCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp <= this.cacheTtlMs) {
        return {
          ...cached.payload,
          cacheHit: true
        };
      }
    }

    if (!normalizedMessage) {
      throw new Error('User message is empty');
    }

    const agentResult = await GeminiChatService.chatWithTools({
      message: normalizedMessage,
      history: conversationHistory,
      imageBase64,
      sessionId: context?.sessionId || null,
      userId: context?.userId || null
    });

    this._logUnifiedFlowDebug({
      userMessage: normalizedMessage,
      masterContext: '[AGENT_TOOL_CALLING_MODE]',
      finalPrompt: [
        {
          role: 'user',
          content: normalizedMessage
        }
      ]
    });

    const payload = {
      answer: String(agentResult?.text || '').trim(),
      sources: Array.isArray(agentResult?.sources) ? agentResult.sources : [],
      products: Array.isArray(agentResult?.products) ? agentResult.products : [],
      provider: agentResult?.provider || 'gemini',
      model: agentResult?.model || 'unknown',
      cacheHit: false,
      flow: 'gemini_native_multimodal_tool_calling',
      toolTrace: Array.isArray(agentResult?.toolTrace) ? agentResult.toolTrace : []
    };

    if (!payload.answer) {
      throw new Error('LLM returned empty answer');
    }

    if (this.cacheEnabled) {
      this.responseCache.set(cacheKey, {
        timestamp: Date.now(),
        payload
      });

      // Keep memory bounded in long-lived processes.
      if (this.responseCache.size > 500) {
        const oldestKey = this.responseCache.keys().next().value;
        if (oldestKey) {
          this.responseCache.delete(oldestKey);
        }
      }
    }

    return payload;
  }

  _generateRoutingId() {
    return `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _logRouting(entry) {
    this.routingLogs.push(entry);
    if (this.routingLogs.length > this.maxLogSize) {
      this.routingLogs.shift();
    }
  }

  getStats() {
    const totalRoutes = this.routingLogs.length;
    const successfulRoutes = this.routingLogs.filter((r) => r.success).length;

    return {
      totalRoutes,
      successfulRoutes,
      failedRoutes: totalRoutes - successfulRoutes,
      successRate: totalRoutes > 0 ? successfulRoutes / totalRoutes : 1,
      avgExecutionTime: totalRoutes > 0
        ? this.routingLogs.reduce((sum, r) => sum + (r.executionTime || 0), 0) / totalRoutes
        : 0,
      registeredAgents: this.listAgents().length
    };
  }

  getRecentLogs(limit = 20) {
    const safeLimit = Math.max(1, Number(limit) || 20);
    return this.routingLogs.slice(-safeLimit);
  }

  healthCheck() {
    return {
      status: 'healthy',
      registeredAgents: this.listAgents().length,
      recentRoutes: this.routingLogs.length,
      timestamp: new Date().toISOString()
    };
  }

  getHealthDetails() {
    const now = Date.now();
    let freshCacheEntries = 0;

    for (const item of this.responseCache.values()) {
      if (item && now - item.timestamp <= this.cacheTtlMs) {
        freshCacheEntries += 1;
      }
    }

    return {
      status: 'healthy',
      cache: {
        enabled: this.cacheEnabled,
        ttlMs: this.cacheTtlMs,
        totalEntries: this.responseCache.size,
        freshEntries: freshCacheEntries
      },
      provider: this.getProviderDiagnostics(),
      routing: this.getStats(),
      timestamp: new Date().toISOString()
    };
  }

  getProviderDiagnostics() {
    if (typeof GeminiChatService.getProviderDiagnostics === 'function') {
      return GeminiChatService.getProviderDiagnostics();
    }

    return {
      status: 'unavailable'
    };
  }

  getLastSearchedProducts() {
    if (typeof GeminiChatService.getLastSearchedProducts === 'function') {
      return GeminiChatService.getLastSearchedProducts();
    }

    return [];
  }
}

module.exports = new AIRouter();
