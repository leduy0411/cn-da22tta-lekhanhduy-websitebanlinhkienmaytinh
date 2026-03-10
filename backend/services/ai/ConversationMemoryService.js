/**
 * Conversation Memory Service
 * Manages conversation history and context tracking
 * 
 * @module services/ai/ConversationMemoryService
 * @description Enhanced conversation persistence with context extraction
 */

const ChatbotConversation = require('../../models/ChatbotConversation');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class ConversationMemoryService {
  constructor() {
    this.summarizationThreshold = 10; // Summarize after 10 messages
    this.maxHistoryLength = 50; // Keep last 50 messages
    
    // Initialize Gemini for summarization
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.gemini.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      });
    }
  }

  /**
   * Create new conversation session
   * @param {String} userId - Optional user ID
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Created conversation
   */
  async createSession(userId = null, metadata = {}) {
    try {
      const conversation = new ChatbotConversation({
        userId,
        messages: [],
        context: {
          interestedProducts: [],
          priceRange: {},
          categories: [],
          brands: [],
          lastIntent: null
        },
        metadata,
        status: 'active'
      });

      await conversation.save();

      console.log(`✅ Created conversation session: ${conversation.sessionId}`);

      return {
        success: true,
        sessionId: conversation.sessionId,
        conversation
      };
    } catch (error) {
      console.error('❌ Error creating session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add message to conversation
   * @param {String} sessionId - Session ID
   * @param {String} role - 'user' or 'assistant'
   * @param {String} content - Message content
   * @param {Object} metadata - Message metadata
   * @returns {Object} Updated conversation
   */
  async addMessage(sessionId, role, content, metadata = {}) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Add message
      conversation.messages.push({
        role,
        content,
        timestamp: new Date(),
        metadata
      });

      // Update last message
      if (role === 'user') {
        conversation.lastMessage = content;
      }

      // Update context from metadata
      if (metadata.intent) {
        conversation.context.lastIntent = metadata.intent;
      }

      if (metadata.entities) {
        this._updateContextFromEntities(conversation.context, metadata.entities);
      }

      if (metadata.products && metadata.products.length > 0) {
        // Add to interested products (keep unique, max 20)
        const newProductIds = metadata.products.filter(
          pid => !conversation.context.interestedProducts.includes(pid)
        );
        conversation.context.interestedProducts.push(...newProductIds);
        conversation.context.interestedProducts = 
          conversation.context.interestedProducts.slice(-20);
      }

      conversation.updatedAt = new Date();

      // Trim messages if too long
      if (conversation.messages.length > this.maxHistoryLength) {
        conversation.messages = conversation.messages.slice(-this.maxHistoryLength);
      }

      // Generate summary if threshold reached
      if (conversation.messages.length % this.summarizationThreshold === 0) {
        await this._generateSummary(conversation);
      }

      await conversation.save();

      return {
        success: true,
        conversation,
        messageCount: conversation.messages.length
      };
    } catch (error) {
      console.error('❌ Error adding message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get conversation by session ID
   * @param {String} sessionId - Session ID
   * @param {Object} options - Query options
   * @returns {Object} Conversation
   */
  async getSession(sessionId, options = {}) {
    try {
      const { includeMessages = true, messageLimit = 20 } = options;

      let query = ChatbotConversation.findOne({ sessionId });

      if (!includeMessages) {
        query = query.select('-messages');
      }

      const conversation = await query.lean();

      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }

      // Limit messages if requested
      if (includeMessages && conversation.messages && conversation.messages.length > messageLimit) {
        conversation.messages = conversation.messages.slice(-messageLimit);
      }

      return {
        success: true,
        conversation
      };
    } catch (error) {
      console.error('❌ Error getting session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update conversation context
   * @param {String} sessionId - Session ID
   * @param {Object} contextUpdate - Context fields to update
   * @returns {Object} Updated conversation
   */
  async updateContext(sessionId, contextUpdate) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Merge context updates
      Object.keys(contextUpdate).forEach(key => {
        if (Array.isArray(contextUpdate[key])) {
          // For arrays, merge uniquely
          conversation.context[key] = [
            ...new Set([...conversation.context[key] || [], ...contextUpdate[key]])
          ];
        } else if (typeof contextUpdate[key] === 'object' && contextUpdate[key] !== null) {
          // For objects, merge properties
          conversation.context[key] = {
            ...conversation.context[key],
            ...contextUpdate[key]
          };
        } else {
          // For primitives, replace
          conversation.context[key] = contextUpdate[key];
        }
      });

      conversation.updatedAt = new Date();
      await conversation.save();

      return {
        success: true,
        context: conversation.context
      };
    } catch (error) {
      console.error('❌ Error updating context:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user's conversation history
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Conversations
   */
  async getUserSessions(userId, options = {}) {
    try {
      const { limit = 10, status = null, includeMessages = false } = options;

      let query = ChatbotConversation.find({ userId });

      if (status) {
        query = query.where('status').equals(status);
      }

      query = query.sort({ updatedAt: -1 }).limit(limit);

      if (!includeMessages) {
        query = query.select('-messages');
      }

      const conversations = await query.lean();

      return {
        success: true,
        count: conversations.length,
        conversations
      };
    } catch (error) {
      console.error('❌ Error getting user sessions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Archive conversation
   * @param {String} sessionId - Session ID
   * @returns {Object} Result
   */
  async archiveSession(sessionId) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      conversation.status = 'archived';
      conversation.updatedAt = new Date();
      await conversation.save();

      return {
        success: true,
        message: 'Conversation archived'
      };
    } catch (error) {
      console.error('❌ Error archiving session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete conversation
   * @param {String} sessionId - Session ID
   * @returns {Object} Result
   */
  async deleteSession(sessionId) {
    try {
      await ChatbotConversation.deleteOne({ sessionId });

      return {
        success: true,
        message: 'Conversation deleted'
      };
    } catch (error) {
      console.error('❌ Error deleting session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate conversation summary using AI
   * @param {Object} conversation - Conversation document
   * @private
   */
  async _generateSummary(conversation) {
    try {
      if (!this.model) {
        console.log('⚠️ Gemini not configured, skipping summarization');
        return;
      }

      // Get last 10 messages
      const recentMessages = conversation.messages.slice(-10);
      const messagesText = recentMessages.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n\n');

      const prompt = `Tóm tắt cuộc hội thoại sau đây bằng tiếng Việt (2-3 câu ngắn gọn):

${messagesText}

Tóm tắt:`;

      const result = await this.model.generateContent(prompt);
      const summary = result.response.text();

      conversation.summary = summary.trim();
      console.log(`📝 Generated summary for session ${conversation.sessionId}`);
    } catch (error) {
      console.error('❌ Error generating summary:', error);
      // Non-critical, continue without summary
    }
  }

  /**
   * Update context from extracted entities
   * @param {Object} context - Context object
   * @param {Object} entities - Extracted entities
   * @private
   */
  _updateContextFromEntities(context, entities) {
    // Update price range
    if (entities.price) {
      if (entities.price.min !== undefined) {
        context.priceRange.min = entities.price.min;
      }
      if (entities.price.max !== undefined) {
        context.priceRange.max = entities.price.max;
      }
    }

    // Update categories
    if (entities.category && !context.categories.includes(entities.category)) {
      context.categories.push(entities.category);
      // Keep only last 5 categories
      context.categories = context.categories.slice(-5);
    }

    // Update brands
    if (entities.brands && Array.isArray(entities.brands)) {
      entities.brands.forEach(brand => {
        if (!context.brands.includes(brand)) {
          context.brands.push(brand);
        }
      });
      // Keep only last 5 brands
      context.brands = context.brands.slice(-5);
    }
  }

  /**
   * Get conversation statistics
   * @param {String} sessionId - Session ID
   * @returns {Object} Statistics
   */
  async getSessionStats(sessionId) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId }).lean();

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const userMessages = conversation.messages.filter(m => m.role === 'user').length;
      const assistantMessages = conversation.messages.filter(m => m.role === 'assistant').length;

      const intentCounts = {};
      conversation.messages.forEach(msg => {
        if (msg.metadata?.intent) {
          intentCounts[msg.metadata.intent] = (intentCounts[msg.metadata.intent] || 0) + 1;
        }
      });

      return {
        success: true,
        stats: {
          totalMessages: conversation.messages.length,
          userMessages,
          assistantMessages,
          intentDistribution: intentCounts,
          interestedProducts: conversation.context.interestedProducts?.length || 0,
          categories: conversation.context.categories?.length || 0,
          brands: conversation.context.brands?.length || 0,
          duration: conversation.updatedAt - conversation.createdAt,
          status: conversation.status
        }
      };
    } catch (error) {
      console.error('❌ Error getting session stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new ConversationMemoryService();
