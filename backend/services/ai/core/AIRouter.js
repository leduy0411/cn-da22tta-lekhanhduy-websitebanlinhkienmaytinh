/**
 * Unified AI Router
 * Single flow for every message:
 * user_message -> RAG retrieval -> Groq generation -> frontend response
 */

const RAGPipeline = require('../rag/RAGPipeline');

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

  async routeQuery(userMessage) {
    return {
      intent: 'unified',
      explicit_filters: {},
      semantic_needs: String(userMessage || '')
    };
  }

  async route(message, context = {}) {
    const routingId = this._generateRoutingId();
    const startedAt = Date.now();

    try {
      const routed = await this.routeQuery(message);
      const result = await this._handleUnifiedFlow(message, context);
      const executionTime = Date.now() - startedAt;

      this._logRouting({
        routingId,
        message,
        intent: routed.intent,
        executionTime,
        success: true,
        timestamp: new Date()
      });

      return {
        success: true,
        routingId,
        intent: routed.intent,
        confidence: 1,
        agent: 'UnifiedRAGRouter',
        result,
        executionTime,
        metadata: {
          explicit_filters: routed.explicit_filters,
          semantic_needs: routed.semantic_needs
        }
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
      history = [],
      sessionId = null,
      userId = null
    } = params;

    const routed = await this.route(userMessage, {
      sessionId,
      userId,
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

  async _handleUnifiedFlow(userMessage, context = {}) {
    const normalizedMessage = String(userMessage || '').trim();
    const sessionKey = String(context?.sessionId || 'anonymous');
    const cacheKey = `${sessionKey}::${normalizedMessage.toLowerCase()}`;

    if (this.cacheEnabled) {
      const cached = this.responseCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp <= this.cacheTtlMs) {
        return {
          ...cached.payload,
          cacheHit: true
        };
      }
    }

    const response = await RAGPipeline.query(normalizedMessage, {
      pipeline: 'auto',
      conversationHistory: Array.isArray(context.conversationHistory) ? context.conversationHistory : [],
      includeProducts: true,
      maxKnowledgeDocs: 5,
      maxProducts: 6,
      minSimilarity: 0.3
    });

    if (!response || typeof response.answer !== 'string' || !response.answer.trim()) {
      throw new Error('RAG pipeline returned invalid response');
    }

    const payload = {
      answer: response.answer,
      sources: Array.isArray(response.sources) ? response.sources : [],
      products: Array.isArray(response.products) ? response.products : [],
      provider: response.sourceProvider || 'unknown',
      model: response.sourceModel || 'unknown',
      cacheHit: false
    };

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
      routing: this.getStats(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AIRouter();
