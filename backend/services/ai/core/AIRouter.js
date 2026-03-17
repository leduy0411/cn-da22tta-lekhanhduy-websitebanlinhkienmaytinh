/**
 * AI Router
 * Routes requests to appropriate agents based on intent and plan
 * 
 * @module services/ai/core/AIRouter
 * @description Orchestrates multi-agent execution and result aggregation
 */

const IntentDetector = require('./IntentDetector');
const ReasoningPlanner = require('./ReasoningPlanner');
const ToolSystem = require('./ToolSystem');
const GroqChatService = require('./GroqChatService');

class AIRouter {
  constructor() {
    this.agents = new Map();
    this.routingLogs = [];
    this.maxLogSize = 500;
  }

  /**
   * Register an agent
   * @param {string} name - Agent name
   * @param {Object} agent - Agent instance
   */
  registerAgent(name, agent) {
    if (!agent.execute || typeof agent.execute !== 'function') {
      throw new Error('Agent must have an execute function');
    }

    this.agents.set(name, {
      name,
      agent,
      registeredAt: new Date()
    });

    console.log(`✅ Agent registered: ${name}`);
  }

  /**
   * Route request to appropriate agent
   * @param {string} message - User message
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Agent response
   */
  async route(message, context = {}) {
    const routingId = this._generateRoutingId();
    const startTime = Date.now();

    try {
      // 1. Detect intent (Groq primary, regex fallback)
      console.log(`🔍 [${routingId}] Detecting intent...`);
      const intentResult = await this._detectIntent(message, context.conversationHistory || []);
      
      console.log(`✅ Intent: ${intentResult.intent} (confidence: ${(intentResult.confidence * 100).toFixed(1)}%)`);

      const toolCallResult = await this._tryCompatibilityToolCall(message, context, intentResult);
      if (toolCallResult) {
        const executionTime = Date.now() - startTime;
        this._logRouting({
          routingId,
          message,
          intent: intentResult.intent,
          agent: 'pcCompatibilityCheck',
          executionTime,
          success: true,
          timestamp: new Date()
        });

        return {
          success: true,
          routingId,
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          agent: 'pcCompatibilityCheck',
          result: toolCallResult,
          executionTime,
          metadata: {
            intentReasoning: intentResult.reasoning || 'tool-call',
            entities: intentResult.entities || {}
          }
        };
      }

      // Short-circuit: general chat is handled by LLM directly for speed/cost.
      if (['general_chat', 'greeting', 'help'].includes(intentResult.intent)) {
        const llmResult = await GroqChatService.generateGeneralChat(message, context.conversationHistory || []);
        const executionTime = Date.now() - startTime;

        this._logRouting({
          routingId,
          message,
          intent: intentResult.intent,
          agent: 'GroqChatService',
          executionTime,
          success: true,
          timestamp: new Date()
        });

        return {
          success: true,
          routingId,
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          agent: 'GroqChatService',
          result: {
            answer: llmResult.text,
            source: llmResult.provider,
            model: llmResult.model
          },
          executionTime,
          metadata: {
            intentReasoning: intentResult.reasoning || 'llm-intent',
            entities: intentResult.entities || {}
          }
        };
      }

      // 2. Create execution plan
      console.log(`📋 [${routingId}] Creating execution plan...`);
      const plan = await ReasoningPlanner.createPlan(intentResult, {
        ...context,
        originalQuery: message
      });

      console.log(`✅ Plan created: ${plan.steps.length} steps, using ${plan.agent}`);

      // 3. Validate plan
      const validation = ReasoningPlanner.validatePlan(plan);
      if (!validation.valid) {
        throw new Error(`Plan validation failed: ${validation.errors.join(', ')}`);
      }

      // 4. Route to agent
      console.log(`🚀 [${routingId}] Routing to ${plan.agent}...`);
      const agentEntry = this.agents.get(plan.agent);

      if (!agentEntry) {
        console.warn(`⚠️ Agent ${plan.agent} not found, using fallback`);
        return this._fallbackResponse(message, intentResult, plan);
      }

      // 5. Execute agent
      const agentResult = await agentEntry.agent.execute({
        message,
        intent: intentResult,
        plan,
        context
      });

      const executionTime = Date.now() - startTime;

      // 6. Log routing
      this._logRouting({
        routingId,
        message,
        intent: intentResult.intent,
        agent: plan.agent,
        executionTime,
        success: true,
        timestamp: new Date()
      });

      console.log(`✅ [${routingId}] Completed in ${executionTime}ms`);

      return {
        success: true,
        routingId,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        agent: plan.agent,
        plan: {
          steps: plan.steps.length,
          complexity: plan.complexity,
          estimatedTime: plan.estimatedTime
        },
        result: agentResult,
        executionTime,
        metadata: {
          intentReasoning: intentResult.reasoning,
          entities: intentResult.entities
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      console.error(`❌ [${routingId}] Routing failed:`, error);

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

  /**
   * Route to multiple agents in parallel (for complex queries)
   * @param {string} message - User message
   * @param {Array} agentNames - Agents to execute
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Aggregated response
   */
  async routeParallel(message, agentNames, context = {}) {
    const routingId = this._generateRoutingId();
    const startTime = Date.now();

    try {
      console.log(`🔀 [${routingId}] Parallel routing to: ${agentNames.join(', ')}`);

      // Detect intent once
      const intentResult = await this._detectIntent(message, context.conversationHistory || []);

      // Execute agents in parallel
      const agentPromises = agentNames.map(async (agentName) => {
        const agentEntry = this.agents.get(agentName);
        
        if (!agentEntry) {
          return {
            agent: agentName,
            success: false,
            error: 'Agent not found'
          };
        }

        try {
          // Create plan for this agent
          const plan = await ReasoningPlanner.createPlan(intentResult, {
            ...context,
            originalQuery: message,
            targetAgent: agentName
          });

          const result = await agentEntry.agent.execute({
            message,
            intent: intentResult,
            plan,
            context
          });

          return {
            agent: agentName,
            success: true,
            result
          };
        } catch (error) {
          return {
            agent: agentName,
            success: false,
            error: error.message
          };
        }
      });

      const results = await Promise.all(agentPromises);

      const executionTime = Date.now() - startTime;

      console.log(`✅ [${routingId}] Parallel execution completed in ${executionTime}ms`);

      return {
        success: true,
        routingId,
        intent: intentResult.intent,
        mode: 'parallel',
        results,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      console.error(`❌ [${routingId}] Parallel routing failed:`, error);

      return {
        success: false,
        routingId,
        mode: 'parallel',
        error: error.message,
        executionTime
      };
    }
  }

  /**
   * Route request with streaming response
   * @param {string} message - User message
   * @param {Object} context - Request context
   * @param {Function} onChunk - Callback for each response chunk
   * @returns {Promise<Object>} Final response
   */
  async routeStreaming(message, context = {}, onChunk) {
    const routingId = this._generateRoutingId();
    const startTime = Date.now();

    try {
      // 1. Detect intent
      const intentResult = await this._detectIntent(message, context.conversationHistory || []);
      
      onChunk?.({
        type: 'intent',
        data: {
          intent: intentResult.intent,
          confidence: intentResult.confidence
        }
      });

      // Fast path for general chat
      if (['general_chat', 'greeting', 'help'].includes(intentResult.intent)) {
        const llmResult = await GroqChatService.generateGeneralChat(message, context.conversationHistory || []);
        onChunk?.({
          type: 'result',
          data: {
            answer: llmResult.text,
            source: llmResult.provider,
            model: llmResult.model
          }
        });
        return {
          answer: llmResult.text,
          source: llmResult.provider,
          model: llmResult.model
        };
      }

      // 2. Create plan
      const plan = await ReasoningPlanner.createPlan(intentResult, {
        ...context,
        originalQuery: message
      });

      onChunk?.({
        type: 'plan',
        data: {
          agent: plan.agent,
          steps: plan.steps.length
        }
      });

      // 3. Execute agent with streaming
      const agentEntry = this.agents.get(plan.agent);

      if (!agentEntry) {
        throw new Error(`Agent ${plan.agent} not found`);
      }

      // Check if agent supports streaming
      if (agentEntry.agent.executeStreaming) {
        const result = await agentEntry.agent.executeStreaming({
          message,
          intent: intentResult,
          plan,
          context
        }, onChunk);

        return result;
      } else {
        // Fallback to regular execution
        const result = await agentEntry.agent.execute({
          message,
          intent: intentResult,
          plan,
          context
        });

        onChunk?.({
          type: 'result',
          data: result
        });

        return result;
      }

    } catch (error) {
      console.error(`❌ [${routingId}] Streaming routing failed:`, error);

      onChunk?.({
        type: 'error',
        data: { error: error.message }
      });

      throw error;
    }
  }

  /**
   * Fallback response when agent not found
   * @private
   */
  async _fallbackResponse(message, intentResult, plan) {
    console.log('⚠️ Using fallback response');

    // Try to execute tools directly if possible
    if (plan.tools && plan.tools.length > 0) {
      try {
        const toolName = plan.tools[0];
        const toolResult = await ToolSystem.execute(toolName, {
          query: message,
          limit: 5
        });

        return {
          answer: `Tôi đã tìm thấy một số thông tin liên quan đến yêu cầu của bạn.`,
          data: toolResult.data,
          source: 'fallback_tool_execution'
        };
      } catch (error) {
        console.error('Fallback tool execution failed:', error);
      }
    }

    // Generic fallback
    return {
      answer: `Xin lỗi, tôi chưa thể xử lý yêu cầu này. Intent được nhận diện là "${intentResult.intent}" nhưng agent tương ứng chưa được đăng ký. Vui lòng thử lại sau khi hệ thống được cấu hình đầy đủ.`,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      source: 'fallback_generic'
    };
  }

  /**
   * Generate unique routing ID
   * @private
   */
  _generateRoutingId() {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async _detectIntent(message, conversationHistory) {
    // LLM-based intent detection with strict fallback to current rule-based detector.
    try {
      const llmIntent = await GroqChatService.detectIntent(message, conversationHistory);
      if (!llmIntent?.intent) {
        throw new Error('LLM intent payload invalid');
      }

      const entitiesResult = await IntentDetector.detect(message, conversationHistory);
      return {
        intent: llmIntent.intent,
        confidence: Number(llmIntent.confidence || entitiesResult.confidence || 0.6),
        entities: entitiesResult.entities || {},
        reasoning: llmIntent.reasoning || 'llm-detected',
        allScores: entitiesResult.allScores || {}
      };
    } catch (error) {
      console.warn('LLM intent detection failed, fallback to rule-based:', error.message);
      return IntentDetector.detect(message, conversationHistory);
    }
  }

  async _tryCompatibilityToolCall(message, context, intentResult) {
    const shouldCheck = ['pc_build', 'comparison', 'technical_question', 'product_details'].includes(intentResult.intent)
      || /compatible|tương thích|socket|ram bus|mainboard|cpu|ddr4|ddr5/i.test(message);

    if (!shouldCheck) {
      return null;
    }

    try {
      const schema = ToolSystem.getPCToolSchema();
      const planner = await GroqChatService.chat([
        {
          role: 'system',
          content: [
            'Bạn là AI planner cho tool-call phần cứng.',
            'Nhiệm vụ: nếu câu hỏi có đủ dữ liệu CPU/Mainboard/RAM thì tạo JSON gọi tool.',
            'Nếu không đủ dữ liệu thì trả useTool=false.',
            'Chỉ trả JSON thuần, không markdown.',
            'Schema output:',
            '{"useTool": boolean, "arguments": {"cpu": {...}, "motherboard": {...}, "ram": {...}}, "missing": string[]}'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({
            message,
            entities: intentResult.entities || {},
            conversationHistory: (context.conversationHistory || []).slice(-3),
            toolSchema: schema
          })
        }
      ], {
        temperature: 0,
        maxTokens: 420
      });

      let callPlan;
      try {
        callPlan = JSON.parse(planner.text);
      } catch (parseError) {
        return null;
      }

      if (!callPlan?.useTool) {
        return null;
      }

      const args = callPlan.arguments || {};
      if (!args.cpu || !args.motherboard || !args.ram) {
        return {
          answer: `Mình chưa đủ dữ liệu để kiểm tra tương thích tự động. Thiếu: ${(callPlan.missing || []).join(', ') || 'CPU/Mainboard/RAM'}.`,
          compatibility: null,
          source: 'tool-call-missing-args'
        };
      }

      const toolResult = await ToolSystem.execute('pcCompatibilityCheck', args);
      if (!toolResult.success) {
        return {
          answer: `Không thể chạy kiểm tra tương thích: ${toolResult.error || 'unknown error'}.`,
          compatibility: null,
          source: 'tool-call-failed'
        };
      }

      const explanation = await GroqChatService.chat([
        {
          role: 'system',
          content: [
            'Bạn là tư vấn viên linh kiện PC.',
            'Dựa 100% vào JSON kết quả tool để trả lời ngắn gọn tiếng Việt.',
            'Nêu rõ hợp lệ hay không hợp lệ, và lý do chính.',
            'Không bịa thêm thông số.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({ tool: 'pcCompatibilityCheck', output: toolResult.data })
        }
      ], {
        temperature: 0.1,
        maxTokens: 300
      });

      return {
        answer: explanation.text,
        compatibility: toolResult.data,
        source: explanation.provider
      };
    } catch (error) {
      console.warn('Compatibility tool-call flow skipped:', error.message);
      return null;
    }
  }

  /**
   * Log routing execution
   * @private
   */
  _logRouting(log) {
    this.routingLogs.push(log);

    if (this.routingLogs.length > this.maxLogSize) {
      this.routingLogs = this.routingLogs.slice(-this.maxLogSize);
    }
  }

  /**
   * Get routing logs
   * @param {number} limit - Max logs to return
   * @returns {Array} Routing logs
   */
  getLogs(limit = 50) {
    return this.routingLogs.slice(-limit);
  }

  /**
   * Get routing statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const total = this.routingLogs.length;
    const successful = this.routingLogs.filter(log => log.success).length;
    const failed = this.routingLogs.filter(log => !log.success).length;

    const intentCounts = {};
    const agentCounts = {};
    let totalExecutionTime = 0;

    this.routingLogs.forEach(log => {
      if (log.intent) {
        intentCounts[log.intent] = (intentCounts[log.intent] || 0) + 1;
      }
      if (log.agent) {
        agentCounts[log.agent] = (agentCounts[log.agent] || 0) + 1;
      }
      if (log.executionTime) {
        totalExecutionTime += log.executionTime;
      }
    });

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : '0%',
      averageExecutionTime: total > 0 ? Math.round(totalExecutionTime / total) : 0,
      intentDistribution: intentCounts,
      agentDistribution: agentCounts,
      registeredAgents: Array.from(this.agents.keys())
    };
  }

  /**
   * List all registered agents
   * @returns {Array} Agent list
   */
  listAgents() {
    return Array.from(this.agents.values()).map(entry => ({
      name: entry.name,
      registeredAt: entry.registeredAt
    }));
  }

  /**
   * Check if agent is registered
   * @param {string} agentName - Agent name
   * @returns {boolean} Is registered
   */
  hasAgent(agentName) {
    return this.agents.has(agentName);
  }

  /**
   * Unregister agent
   * @param {string} agentName - Agent name
   */
  unregisterAgent(agentName) {
    if (this.agents.has(agentName)) {
      this.agents.delete(agentName);
      console.log(`❌ Agent unregistered: ${agentName}`);
      return true;
    }
    return false;
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.routingLogs = [];
    console.log('🗑️ Routing logs cleared');
  }

  /**
   * Health check
   * @returns {Object} Health status
   */
  healthCheck() {
    const agentCount = this.agents.size;
    const toolCount = ToolSystem.listTools().length;
    const recentLogs = this.routingLogs.slice(-10);
    const recentFailures = recentLogs.filter(log => !log.success).length;

    return {
      status: agentCount > 0 ? 'healthy' : 'degraded',
      agents: {
        count: agentCount,
        registered: Array.from(this.agents.keys())
      },
      tools: {
        count: toolCount
      },
      performance: {
        recentFailures,
        recentSuccesses: recentLogs.length - recentFailures
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AIRouter();
