/**
 * AI Reasoning Planner
 * Creates execution plans based on detected intent and entities
 * 
 * @module services/ai/core/ReasoningPlanner
 * @description Generates step-by-step execution plans for AI agents
 */

class ReasoningPlanner {
  constructor() {
    // Plan templates for each intent type
    this.planTemplates = {
      product_search: {
        agent: 'ProductSearchAgent',
        steps: [
          { action: 'validate_query', description: 'Validate search parameters' },
          { action: 'extract_filters', description: 'Extract category, price, brand filters' },
          { action: 'hybrid_search', description: 'Execute keyword + semantic search' },
          { action: 'apply_filters', description: 'Apply price, category, brand filters' },
          { action: 'rank_results', description: 'Rank by relevance, rating, price' },
          { action: 'format_response', description: 'Format products for display' }
        ],
        tools: ['searchProducts', 'rankResults', 'filterProducts']
      },

      recommendation: {
        agent: 'RecommendationAgent',
        steps: [
          { action: 'analyze_context', description: 'Analyze user preferences and history' },
          { action: 'determine_strategy', description: 'Choose recommendation strategy' },
          { action: 'fetch_candidates', description: 'Get candidate products' },
          { action: 'personalize', description: 'Apply personalization filters' },
          { action: 'diversify', description: 'Ensure diversity in recommendations' },
          { action: 'format_response', description: 'Format with reasons' }
        ],
        tools: ['getUserPreferences', 'recommendProducts', 'analyzeHistory']
      },

      comparison: {
        agent: 'ComparisonAgent',
        steps: [
          { action: 'identify_products', description: 'Identify products to compare' },
          { action: 'fetch_details', description: 'Fetch full product specifications' },
          { action: 'extract_key_specs', description: 'Extract comparable attributes' },
          { action: 'generate_comparison', description: 'Create comparison table' },
          { action: 'highlight_differences', description: 'Highlight key differences' },
          { action: 'provide_recommendation', description: 'Recommend best option' }
        ],
        tools: ['getProductDetails', 'compareProducts', 'analyzeSpecs']
      },

      pc_build: {
        agent: 'PCBuilderAgent',
        steps: [
          { action: 'validate_budget', description: 'Validate budget and purpose' },
          { action: 'allocate_budget', description: 'Allocate budget per component' },
          { action: 'select_cpu', description: 'Select CPU based on purpose' },
          { action: 'select_gpu', description: 'Select compatible GPU' },
          { action: 'select_motherboard', description: 'Select compatible motherboard' },
          { action: 'select_ram', description: 'Select appropriate RAM' },
          { action: 'select_storage', description: 'Select SSD/HDD' },
          { action: 'select_psu', description: 'Select PSU with adequate wattage' },
          { action: 'select_case', description: 'Select compatible case' },
          { action: 'validate_compatibility', description: 'Check all compatibility rules' },
          { action: 'provide_alternatives', description: 'Suggest alternatives if needed' }
        ],
        tools: ['buildPCConfiguration', 'checkCompatibility', 'suggestAlternatives']
      },

      knowledge_question: {
        agent: 'KnowledgeAgent',
        steps: [
          { action: 'classify_question', description: 'Classify question type' },
          { action: 'search_knowledge', description: 'Search knowledge base' },
          { action: 'retrieve_context', description: 'Retrieve relevant information' },
          { action: 'generate_explanation', description: 'Generate detailed explanation' },
          { action: 'provide_examples', description: 'Add examples if applicable' }
        ],
        tools: ['searchKnowledge', 'generateExplanation']
      },

      price_inquiry: {
        agent: 'ProductSearchAgent',
        steps: [
          { action: 'identify_product', description: 'Identify product from query' },
          { action: 'search_product', description: 'Search for exact product' },
          { action: 'fetch_pricing', description: 'Get current price and availability' },
          { action: 'check_promotions', description: 'Check for active promotions' },
          { action: 'format_response', description: 'Format price information' }
        ],
        tools: ['searchProducts', 'getProductDetails']
      },

      product_details: {
        agent: 'ProductSearchAgent',
        steps: [
          { action: 'identify_product', description: 'Identify specific product' },
          { action: 'fetch_details', description: 'Fetch full product details' },
          { action: 'format_specifications', description: 'Format technical specifications' },
          { action: 'add_reviews', description: 'Include relevant reviews' },
          { action: 'suggest_alternatives', description: 'Suggest similar products' }
        ],
        tools: ['getProductDetails', 'getSimilarProducts']
      },

      greeting: {
        agent: 'KnowledgeAgent',
        steps: [
          { action: 'generate_greeting', description: 'Generate friendly greeting' },
          { action: 'provide_guidance', description: 'Provide usage guidance' },
          { action: 'suggest_actions', description: 'Suggest what user can do' }
        ],
        tools: []
      },

      help: {
        agent: 'KnowledgeAgent',
        steps: [
          { action: 'understand_help_request', description: 'Understand what user needs help with' },
          { action: 'provide_instructions', description: 'Provide step-by-step instructions' },
          { action: 'suggest_examples', description: 'Give example queries' }
        ],
        tools: ['searchKnowledge']
      },

      general_chat: {
        agent: 'GeneralChatAgent',
        steps: [
          { action: 'load_context', description: 'Load conversation history' },
          { action: 'analyze_message', description: 'Analyze message intent and tone' },
          { action: 'generate_response', description: 'Generate natural conversational response' },
          { action: 'add_personality', description: 'Add friendly personality to response' }
        ],
        tools: []
      },

      technical_question: {
        agent: 'TechKnowledgeAgent',
        steps: [
          { action: 'classify_topic', description: 'Classify technical topic domain' },
          { action: 'search_knowledge_base', description: 'Search vector knowledge base via RAG' },
          { action: 'retrieve_context', description: 'Retrieve relevant knowledge documents' },
          { action: 'augment_prompt', description: 'Build augmented prompt with RAG context' },
          { action: 'generate_explanation', description: 'Generate detailed technical explanation' },
          { action: 'format_response', description: 'Format with examples, diagrams, comparisons' }
        ],
        tools: ['searchKnowledge', 'generateExplanation', 'analyzeSpecs']
      }
    };
  }

  /**
   * Create execution plan based on intent and entities
   * @param {Object} intentResult - Result from IntentDetector
   * @param {Object} conversationContext - Conversation context
   * @returns {Promise<Object>} Execution plan
   */
  async createPlan(intentResult, conversationContext = {}) {
    const { intent, entities, confidence } = intentResult;

    // Get base plan template
    const template = this.planTemplates[intent] || this.planTemplates.greeting;

    // Customize plan based on entities
    const customizedSteps = this._customizeSteps(template.steps, intent, entities);

    // Determine priority and complexity
    const complexity = this._calculateComplexity(customizedSteps);
    const priority = this._determinePriority(intent, entities);

    // Estimate execution time
    const estimatedTime = this._estimateExecutionTime(customizedSteps, complexity);

    // Build parameter map for each step
    const stepsWithParams = customizedSteps.map(step => ({
      ...step,
      params: this._buildStepParams(step, entities, conversationContext)
    }));

    return {
      intent,
      confidence,
      agent: template.agent,
      steps: stepsWithParams,
      tools: template.tools,
      complexity,
      priority,
      estimatedTime,
      metadata: {
        entities,
        conversationContext,
        planGeneratedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Customize steps based on entities
   * @private
   */
  _customizeSteps(baseSteps, intent, entities) {
    const steps = [...baseSteps];

    // Add entity-specific steps
    if (intent === 'product_search') {
      // If user specified brands, add brand filtering step
      if (entities.brand && entities.brand.length > 0) {
        steps.splice(3, 0, {
          action: 'filter_by_brand',
          description: `Filter by brands: ${entities.brand.join(', ')}`
        });
      }

      // If user specified specs, add spec matching step
      if (entities.specs) {
        steps.splice(3, 0, {
          action: 'match_specifications',
          description: 'Match technical specifications'
        });
      }
    }

    if (intent === 'recommendation') {
      // If user provided purchase history, add collaborative filtering
      if (entities.hasHistory) {
        steps.splice(2, 0, {
          action: 'collaborative_filtering',
          description: 'Apply collaborative filtering based on history'
        });
      }
    }

    if (intent === 'pc_build') {
      // Adjust component selection based on purpose
      if (entities.purpose === 'gaming') {
        steps.splice(3, 0, {
          action: 'prioritize_gpu',
          description: 'Prioritize high-performance GPU for gaming'
        });
      } else if (entities.purpose === 'workstation') {
        steps.splice(3, 0, {
          action: 'prioritize_cpu',
          description: 'Prioritize high-core-count CPU for workstation'
        });
      }
    }

    return steps;
  }

  /**
   * Build parameters for each step
   * @private
   */
  _buildStepParams(step, entities, context) {
    const params = {};

    switch (step.action) {
      case 'validate_query':
        params.query = context.originalQuery;
        break;

      case 'extract_filters':
        params.category = entities.category;
        params.brands = entities.brand;
        params.priceRange = entities.price;
        params.specs = entities.specs;
        break;

      case 'hybrid_search':
        params.query = context.originalQuery;
        params.limit = 20;
        params.semanticWeight = 0.6;
        params.keywordWeight = 0.4;
        break;

      case 'apply_filters':
        params.filters = {
          category: entities.category,
          brand: entities.brand,
          price: entities.price,
          specs: entities.specs
        };
        break;

      case 'rank_results':
        params.criteria = ['relevance', 'rating', 'price', 'popularity'];
        params.weights = {
          relevance: 0.4,
          rating: 0.3,
          price: 0.2,
          popularity: 0.1
        };
        break;

      case 'validate_budget':
        params.budget = entities.price?.max || entities.price?.exact;
        params.purpose = entities.purpose;
        break;

      case 'allocate_budget':
        params.budget = entities.price?.max || entities.price?.exact;
        params.purpose = entities.purpose;
        // Gaming: GPU-heavy, Workstation: CPU-heavy, Office: Balanced
        if (entities.purpose === 'gaming') {
          params.allocation = { cpu: 0.25, gpu: 0.40, motherboard: 0.10, ram: 0.10, storage: 0.08, psu: 0.05, case: 0.02 };
        } else if (entities.purpose === 'workstation') {
          params.allocation = { cpu: 0.35, gpu: 0.25, motherboard: 0.12, ram: 0.15, storage: 0.08, psu: 0.03, case: 0.02 };
        } else {
          params.allocation = { cpu: 0.30, gpu: 0.20, motherboard: 0.15, ram: 0.15, storage: 0.12, psu: 0.05, case: 0.03 };
        }
        break;

      case 'identify_products':
        params.productNames = entities.products;
        break;

      case 'analyze_context':
        params.userId = context.userId;
        params.sessionId = context.sessionId;
        params.history = context.conversationHistory;
        break;

      default:
        // Generic params
        params.entities = entities;
        params.context = context;
    }

    return params;
  }

  /**
   * Calculate plan complexity
   * @private
   */
  _calculateComplexity(steps) {
    const stepCount = steps.length;

    if (stepCount <= 3) return 'simple';
    if (stepCount <= 6) return 'moderate';
    if (stepCount <= 10) return 'complex';
    return 'very_complex';
  }

  /**
   * Determine execution priority
   * @private
   */
  _determinePriority(intent, entities) {
    // High priority: order status, help
    if (['order_status', 'help'].includes(intent)) {
      return 'high';
    }

    // Medium-high: comparison, PC build
    if (['comparison', 'pc_build'].includes(intent)) {
      return 'medium-high';
    }

    // Medium: product search with specific filters
    if (intent === 'product_search' && (entities.price || entities.brand)) {
      return 'medium';
    }

    // Normal: everything else
    return 'normal';
  }

  /**
   * Estimate execution time in milliseconds
   * @private
   */
  _estimateExecutionTime(steps, complexity) {
    const baseTimePerStep = {
      simple: 200,
      moderate: 350,
      complex: 500,
      very_complex: 700
    };

    const stepTime = baseTimePerStep[complexity] || 300;
    return steps.length * stepTime;
  }

  /**
   * Optimize plan by removing redundant steps
   * @param {Object} plan - Execution plan
   * @returns {Object} Optimized plan
   */
  optimizePlan(plan) {
    // Remove duplicate actions
    const seenActions = new Set();
    const optimizedSteps = plan.steps.filter(step => {
      if (seenActions.has(step.action)) {
        return false;
      }
      seenActions.add(step.action);
      return true;
    });

    // Reorder for parallel execution where possible
    const parallelizable = this._identifyParallelSteps(optimizedSteps);

    return {
      ...plan,
      steps: optimizedSteps,
      parallelizable,
      optimized: true
    };
  }

  /**
   * Identify steps that can run in parallel
   * @private
   */
  _identifyParallelSteps(steps) {
    const parallel = [];
    
    // Example: fetching product details from multiple sources can be parallelized
    const fetchActions = ['fetch_details', 'fetch_pricing', 'fetch_reviews'];
    const fetchSteps = steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => fetchActions.includes(step.action));

    if (fetchSteps.length > 1) {
      parallel.push({
        group: 'fetch_operations',
        steps: fetchSteps.map(fs => fs.index)
      });
    }

    return parallel;
  }

  /**
   * Validate if plan can be executed
   * @param {Object} plan - Execution plan
   * @returns {Object} Validation result
   */
  validatePlan(plan) {
    const errors = [];
    const warnings = [];

    // Check if agent exists
    if (!plan.agent) {
      errors.push('No agent specified in plan');
    }

    // Check if steps are defined
    if (!plan.steps || plan.steps.length === 0) {
      errors.push('No steps defined in plan');
    }

    // Check if required tools are available
    if (plan.tools && plan.tools.length > 0) {
      // This would check against actual available tools in production
      // For now, we assume all tools are available
    }

    // Check if estimated time is reasonable (< 30 seconds)
    if (plan.estimatedTime > 30000) {
      warnings.push(`Estimated execution time is high: ${plan.estimatedTime}ms`);
    }

    // Check for missing parameters in critical steps
    const criticalActions = ['hybrid_search', 'validate_budget', 'identify_products'];
    plan.steps.forEach((step, index) => {
      if (criticalActions.includes(step.action)) {
        if (!step.params || Object.keys(step.params).length === 0) {
          warnings.push(`Step ${index + 1} (${step.action}) has no parameters`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * Generate human-readable plan summary
   * @param {Object} plan - Execution plan
   * @returns {string} Plan summary
   */
  generatePlanSummary(plan) {
    const lines = [];
    
    lines.push(`🎯 Intent: ${plan.intent} (confidence: ${(plan.confidence * 100).toFixed(1)}%)`);
    lines.push(`🤖 Agent: ${plan.agent}`);
    lines.push(`⚙️ Complexity: ${plan.complexity}`);
    lines.push(`⏱️ Estimated time: ${plan.estimatedTime}ms`);
    lines.push(`📝 Execution steps:`);
    
    plan.steps.forEach((step, index) => {
      lines.push(`   ${index + 1}. ${step.description}`);
    });

    if (plan.tools && plan.tools.length > 0) {
      lines.push(`🛠️ Tools: ${plan.tools.join(', ')}`);
    }

    return lines.join('\n');
  }
}

module.exports = new ReasoningPlanner();
