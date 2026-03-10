/**
 * AI Commerce Assistant - Main Entry Point
 * Orchestrates the multi-agent system
 * 
 * @module services/ai/AICommerceAssistant
 * @description Production-grade AI assistant with multi-agent architecture
 */

const AIRouter = require('./core/AIRouter');
const IntentDetector = require('./core/IntentDetector');
const ReasoningPlanner = require('./core/ReasoningPlanner');
const ToolSystem = require('./core/ToolSystem');

// Import agents
const ProductSearchAgent = require('./agents/ProductSearchAgent');
const RecommendationAgent = require('./agents/RecommendationAgent');
const ComparisonAgent = require('./agents/ComparisonAgent');
const PCBuilderAgent = require('./agents/PCBuilderAgent');
const KnowledgeAgent = require('./agents/KnowledgeAgent');

class AICommerceAssistant {
  constructor() {
    this.initialized = false;
    this.router = AIRouter;
    this.intentDetector = IntentDetector;
    this.planner = ReasoningPlanner;
    this.tools = ToolSystem;
  }

  /**
   * Initialize the AI system
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️ AI Commerce Assistant already initialized');
      return;
    }

    console.log('🚀 Initializing AI Commerce Assistant...');

    try {
      // Register all agents
      this.router.registerAgent('ProductSearchAgent', ProductSearchAgent);
      this.router.registerAgent('RecommendationAgent', RecommendationAgent);
      this.router.registerAgent('ComparisonAgent', ComparisonAgent);
      this.router.registerAgent('PCBuilderAgent', PCBuilderAgent);
      this.router.registerAgent('KnowledgeAgent', KnowledgeAgent);

      this.initialized = true;

      console.log('✅ AI Commerce Assistant initialized successfully');
      console.log(`📊 Registered ${this.router.listAgents().length} agents`);
      console.log(`🛠️ Available ${this.tools.listTools().length} tools`);

      return {
        success: true,
        agents: this.router.listAgents().length,
        tools: this.tools.listTools().length
      };

    } catch (error) {
      console.error('❌ AI Commerce Assistant initialization failed:', error);
      throw error;
    }
  }

  /**
   * Process user message
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @returns {Promise<Object>} AI response
   */
  async chat(message, context = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Route to appropriate agent
      const response = await this.router.route(message, context);

      return response;

    } catch (error) {
      console.error('AI Chat error:', error);
      
      return {
        success: false,
        error: error.message,
        fallback: this._getFallbackResponse(message)
      };
    }
  }

  /**
   * Process user message with streaming
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @param {Function} onChunk - Callback for chunks
   * @returns {Promise<Object>} AI response
   */
  async chatStreaming(message, context = {}, onChunk) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const response = await this.router.routeStreaming(message, context, onChunk);
      return response;

    } catch (error) {
      console.error('AI Streaming Chat error:', error);
      
      onChunk?.({
        type: 'error',
        data: { error: error.message }
      });

      throw error;
    }
  }

  /**
   * Get system health
   * @returns {Object} Health status
   */
  getHealth() {
    return {
      initialized: this.initialized,
      router: this.router.healthCheck(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get system statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      routing: this.router.getStats(),
      tools: {
        available: this.tools.listTools().length,
        recentExecutions: this.tools.getLogs(20)
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Fallback response
   * @private
   */
  _getFallbackResponse(message) {
    return {
      answer: '🤖 Xin lỗi, tôi đang gặp vấn đề kỹ thuật. Vui lòng thử lại sau hoặc liên hệ hotline 1900-xxxx để được hỗ trợ.',
      source: 'fallback'
    };
  }
}

// Export singleton instance
module.exports = new AICommerceAssistant();
