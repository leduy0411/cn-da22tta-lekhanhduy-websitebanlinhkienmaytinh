/**
 * Tool System
 * Dynamic tool calling framework for AI agents
 * 
 * @module services/ai/core/ToolSystem
 * @description Provides a registry of executable tools that agents can use
 */

const Product = require('../../../models/Product');
const ProductEmbedding = require('../../../models/ProductEmbedding');
const UserInteraction = require('../../../models/UserInteraction');
const Order = require('../../../models/Order');
const SemanticSearchService = require('../SemanticSearchService');
const PCBuildTool = require('../tools/PCBuildTool');

class ToolSystem {
  constructor() {
    this.tools = new Map();
    this.executionLogs = [];
    this.maxLogSize = 1000;
    
    // Register all available tools
    this._registerTools();
  }

  /**
   * Register all available tools
   * @private
   */
  _registerTools() {
    // Product Search Tools
    this.register({
      name: 'searchProducts',
      description: 'Search products with filters (keyword + semantic)',
      parameters: {
        query: { type: 'string', required: true, description: 'Search query' },
        category: { type: 'string', required: false, description: 'Product category' },
        brand: { type: 'string', required: false, description: 'Brand filter' },
        minPrice: { type: 'number', required: false, description: 'Minimum price' },
        maxPrice: { type: 'number', required: false, description: 'Maximum price' },
        limit: { type: 'number', required: false, default: 10, description: 'Max results' },
        sortBy: { type: 'string', required: false, default: 'relevance', description: 'Sort criteria' }
      },
      execute: this._searchProducts.bind(this)
    });

    this.register({
      name: 'getProductDetails',
      description: 'Get detailed information about a specific product',
      parameters: {
        productId: { type: 'string', required: true, description: 'Product ID' }
      },
      execute: this._getProductDetails.bind(this)
    });

    this.register({
      name: 'compareProducts',
      description: 'Compare multiple products side-by-side',
      parameters: {
        productIds: { type: 'array', required: true, description: 'Array of product IDs' },
        attributes: { type: 'array', required: false, description: 'Specific attributes to compare' }
      },
      execute: this._compareProducts.bind(this)
    });

    this.register({
      name: 'rankResults',
      description: 'Rank products by specified criteria',
      parameters: {
        products: { type: 'array', required: true, description: 'Products to rank' },
        criteria: { type: 'array', required: true, description: 'Ranking criteria' },
        weights: { type: 'object', required: false, description: 'Weights for each criterion' }
      },
      execute: this._rankResults.bind(this)
    });

    this.register({
      name: 'filterProducts',
      description: 'Filter products by specifications',
      parameters: {
        products: { type: 'array', required: true, description: 'Products to filter' },
        filters: { type: 'object', required: true, description: 'Filter criteria' }
      },
      execute: this._filterProducts.bind(this)
    });

    // Recommendation Tools
    this.register({
      name: 'recommendProducts',
      description: 'Get personalized product recommendations',
      parameters: {
        userId: { type: 'string', required: false, description: 'User ID for personalization' },
        productId: { type: 'string', required: false, description: 'Reference product ID' },
        category: { type: 'string', required: false, description: 'Category filter' },
        limit: { type: 'number', required: false, default: 10, description: 'Max results' },
        strategy: { type: 'string', required: false, default: 'hybrid', description: 'Recommendation strategy' }
      },
      execute: this._recommendProducts.bind(this)
    });

    this.register({
      name: 'getUserPreferences',
      description: 'Analyze user preferences from history',
      parameters: {
        userId: { type: 'string', required: true, description: 'User ID' },
        limit: { type: 'number', required: false, default: 50, description: 'History limit' }
      },
      execute: this._getUserPreferences.bind(this)
    });

    this.register({
      name: 'analyzeHistory',
      description: 'Analyze user interaction history',
      parameters: {
        userId: { type: 'string', required: true, description: 'User ID' },
        days: { type: 'number', required: false, default: 30, description: 'Days to analyze' }
      },
      execute: this._analyzeHistory.bind(this)
    });

    // PC Builder Tools
    this.register({
      name: 'buildPCConfiguration',
      description: 'Build complete PC configuration based on budget and purpose',
      parameters: {
        budget: { type: 'number', required: true, description: 'Total budget in VND' },
        purpose: { type: 'string', required: true, description: 'PC purpose: gaming, workstation, office' },
        preferences: { type: 'object', required: false, description: 'Component preferences' }
      },
      execute: this._buildPCConfiguration.bind(this)
    });

    this.register({
      name: 'checkCompatibility',
      description: 'Check component compatibility',
      parameters: {
        components: { type: 'object', required: true, description: 'PC components to check' }
      },
      execute: this._checkCompatibility.bind(this)
    });

    this.register({
      name: 'pcCompatibilityCheck',
      description: 'Rule-based CPU/Mainboard/RAM compatibility validator',
      parameters: {
        cpu: { type: 'object', required: true, description: 'CPU specs {name, socket}' },
        mainboard: { type: 'object', required: false, description: 'Mainboard specs {name, socket, supportedRamBus[]}' },
        motherboard: { type: 'object', required: false, description: 'Legacy alias for mainboard' },
        ram: { type: 'object', required: true, description: 'RAM specs {name, bus}' }
      },
      execute: this._pcCompatibilityCheck.bind(this)
    });

    this.register({
      name: 'suggestAlternatives',
      description: 'Suggest alternative components',
      parameters: {
        component: { type: 'object', required: true, description: 'Original component' },
        reason: { type: 'string', required: false, description: 'Reason for alternative' }
      },
      execute: this._suggestAlternatives.bind(this)
    });

    // Knowledge Tools
    this.register({
      name: 'searchKnowledge',
      description: 'Search knowledge base for information',
      parameters: {
        query: { type: 'string', required: true, description: 'Knowledge query' },
        category: { type: 'string', required: false, description: 'Knowledge category' }
      },
      execute: this._searchKnowledge.bind(this)
    });

    this.register({
      name: 'generateExplanation',
      description: 'Generate explanation for a concept',
      parameters: {
        concept: { type: 'string', required: true, description: 'Concept to explain' },
        detail: { type: 'string', required: false, default: 'medium', description: 'Detail level: basic, medium, advanced' }
      },
      execute: this._generateExplanation.bind(this)
    });

    // Spec Analysis Tools
    this.register({
      name: 'analyzeSpecs',
      description: 'Analyze technical specifications',
      parameters: {
        productId: { type: 'string', required: true, description: 'Product ID' },
        purpose: { type: 'string', required: false, description: 'Usage purpose' }
      },
      execute: this._analyzeSpecs.bind(this)
    });

    this.register({
      name: 'getSimilarProducts',
      description: 'Find similar products based on specs',
      parameters: {
        productId: { type: 'string', required: true, description: 'Reference product ID' },
        limit: { type: 'number', required: false, default: 5, description: 'Max results' }
      },
      execute: this._getSimilarProducts.bind(this)
    });
  }

  /**
   * Register a new tool
   * @param {Object} tool - Tool definition
   */
  register(tool) {
    if (!tool.name || !tool.execute) {
      throw new Error('Tool must have name and execute function');
    }

    this.tools.set(tool.name, {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || {},
      execute: tool.execute,
      registeredAt: new Date()
    });
  }

  /**
   * Execute a tool by name
   * @param {string} toolName - Name of tool to execute
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(toolName, params = {}) {
    const tool = this.tools.get(toolName);

    if (!tool) {
      console.error(`❌ Tool "${toolName}" not found. Available tools:`, Array.from(this.tools.keys()));
      throw new Error(`Tool "${toolName}" not found`);
    }

    console.log(`🔧 Executing tool: ${toolName}`);
    console.log(`📝 Tool definition:`, JSON.stringify({ name: tool.name, hasExecute: !!tool.execute, paramKeys: tool.parameters ? Object.keys(tool.parameters) : 'NO_PARAMS' }));
    console.log(`📨 Params:`, JSON.stringify(params, null, 2));

    const startTime = Date.now();

    try {
      // Validate parameters
      this._validateParams(tool, params);

      // Execute tool
      const result = await tool.execute(params);

      const executionTime = Date.now() - startTime;

      // Log execution
      this._logExecution({
        tool: toolName,
        params,
        result: { success: true, dataSize: JSON.stringify(result).length },
        executionTime,
        timestamp: new Date()
      });

      return {
        success: true,
        tool: toolName,
        data: result,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      console.error(`❌ Tool execution error for "${toolName}":`, error.message);
      console.error('Stack:', error.stack);

      // Log error
      this._logExecution({
        tool: toolName,
        params,
        result: { success: false, error: error.message },
        executionTime,
        timestamp: new Date()
      });

      return {
        success: false,
        tool: toolName,
        error: error.message,
        executionTime
      };
    }
  }

  /**
   * Execute multiple tools in parallel
   * @param {Array} toolCalls - Array of {tool, params} objects
   * @returns {Promise<Array>} Array of results
   */
  async executeParallel(toolCalls) {
    const promises = toolCalls.map(({ tool, params }) => 
      this.execute(tool, params)
    );

    return Promise.all(promises);
  }

  /**
   * Get tool definition
   * @param {string} toolName - Tool name
   * @returns {Object} Tool definition
   */
  getTool(toolName) {
    const tool = this.tools.get(toolName);
    if (!tool) return null;

    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    };
  }

  /**
   * List all available tools
   * @returns {Array} List of tool definitions
   */
  listTools() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * Validate tool parameters
   * @private
   */
  _validateParams(tool, params) {
    for (const [paramName, config] of Object.entries(tool.parameters)) {
      if (config.required && !(paramName in params)) {
        throw new Error(`Missing required parameter: ${paramName}`);
      }

      if (paramName in params) {
        const value = params[paramName];
        const expectedType = config.type;

        if (expectedType === 'array' && !Array.isArray(value)) {
          throw new Error(`Parameter ${paramName} must be an array`);
        }
        if (expectedType === 'number' && typeof value !== 'number') {
          throw new Error(`Parameter ${paramName} must be a number`);
        }
        if (expectedType === 'string' && typeof value !== 'string') {
          throw new Error(`Parameter ${paramName} must be a string`);
        }
        if (expectedType === 'object' && typeof value !== 'object') {
          throw new Error(`Parameter ${paramName} must be an object`);
        }
      }
    }
  }

  /**
   * Log tool execution
   * @private
   */
  _logExecution(log) {
    this.executionLogs.push(log);

    // Keep only recent logs
    if (this.executionLogs.length > this.maxLogSize) {
      this.executionLogs = this.executionLogs.slice(-this.maxLogSize);
    }
  }

  /**
   * Get execution logs
   * @param {number} limit - Max logs to return
   * @returns {Array} Execution logs
   */
  getLogs(limit = 50) {
    return this.executionLogs.slice(-limit);
  }

  // ==================== TOOL IMPLEMENTATIONS ====================

  /**
   * Search products implementation
   * @private
   */
  async _searchProducts(params) {
    const { query, category, brand, minPrice, maxPrice, limit = 10, sortBy = 'relevance' } = params;

    const result = await SemanticSearchService.searchProducts({
      keyword: query || '',
      vector: null,
      filters: {
        category: category || null,
        brand: brand || null,
        price_min: minPrice ?? null,
        price_max: maxPrice ?? null
      },
      limit
    });

    let products = Array.isArray(result.products) ? [...result.products] : [];

    if (sortBy === 'price_asc') {
      products.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === 'price_desc') {
      products.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy === 'rating') {
      products.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }

    return products.slice(0, Math.max(1, Number(limit) || 10));
  }

  /**
   * Get product details implementation
   * @private
   */
  async _getProductDetails(params) {
    const { productId } = params;

    const product = await Product.findById(productId).lean();

    if (!product) {
      throw new Error('Product not found');
    }

    return product;
  }

  /**
   * Compare products implementation
   * @private
   */
  async _compareProducts(params) {
    const { productIds, attributes } = params;

    const products = await Product.find({ _id: { $in: productIds } }).lean();

    if (products.length === 0) {
      throw new Error('No products found');
    }

    const comparison = {
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        rating: p.rating,
        stock: p.stock
      })),
      specifications: {}
    };

    // Extract all spec keys
    const allSpecKeys = new Set();
    products.forEach(p => {
      if (p.specifications) {
        Object.keys(p.specifications).forEach(key => allSpecKeys.add(key));
      }
    });

    // Build comparison table
    allSpecKeys.forEach(key => {
      comparison.specifications[key] = products.map(p => 
        p.specifications?.[key] || 'N/A'
      );
    });

    return comparison;
  }

  /**
   * Rank results implementation
   * @private
   */
  async _rankResults(params) {
    const { products, criteria, weights = {} } = params;

    const defaultWeights = {
      relevance: 0.4,
      rating: 0.3,
      price: 0.2,
      popularity: 0.1
    };

    const finalWeights = { ...defaultWeights, ...weights };

    const ranked = products.map(product => {
      let score = 0;

      if (criteria.includes('rating')) {
        score += (product.rating || 0) / 5 * finalWeights.rating;
      }

      if (criteria.includes('price')) {
        // Lower price = higher score (normalized)
        const maxPrice = Math.max(...products.map(p => p.price));
        score += (1 - product.price / maxPrice) * finalWeights.price;
      }

      if (criteria.includes('popularity')) {
        score += ((product.reviewCount || 0) / 100) * finalWeights.popularity;
      }

      return {
        ...product,
        _rankScore: score
      };
    });

    ranked.sort((a, b) => b._rankScore - a._rankScore);

    return ranked;
  }

  /**
   * Filter products implementation
   * @private
   */
  async _filterProducts(params) {
    const { products, filters } = params;

    return products.filter(product => {
      // Price filter
      if (filters.minPrice && product.price < filters.minPrice) return false;
      if (filters.maxPrice && product.price > filters.maxPrice) return false;

      // Category filter
      if (filters.category && !product.category.toLowerCase().includes(filters.category.toLowerCase())) {
        return false;
      }

      // Brand filter
      if (filters.brand && product.brand.toLowerCase() !== filters.brand.toLowerCase()) {
        return false;
      }

      // Spec filters
      if (filters.specs) {
        for (const [key, value] of Object.entries(filters.specs)) {
          if (!product.specifications?.[key]?.toLowerCase().includes(value.toLowerCase())) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Recommend products implementation
   * @private
   */
  async _recommendProducts(params) {
    const { userId, productId, category, limit = 10, strategy = 'hybrid' } = params;

    // Simple recommendation: similar products
    const filter = { stock: { $gt: 0 } };

    if (category) {
      filter.category = category;
    }

    if (productId) {
      const refProduct = await Product.findById(productId);
      if (refProduct) {
        filter.category = refProduct.category;
        filter._id = { $ne: productId };
      }
    }

    const recommendations = await Product.find(filter)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(limit)
      .lean();

    return recommendations;
  }

  /**
   * Get user preferences implementation
   * @private
   */
  async _getUserPreferences(params) {
    const { userId, limit = 50 } = params;

    const interactions = await UserInteraction.find({ user: userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Analyze preferences
    const categories = {};
    const brands = {};
    let totalSpent = 0;

    interactions.forEach(interaction => {
      if (interaction.product?.category) {
        categories[interaction.product.category] = (categories[interaction.product.category] || 0) + 1;
      }
      if (interaction.product?.brand) {
        brands[interaction.product.brand] = (brands[interaction.product.brand] || 0) + 1;
      }
      if (interaction.metadata?.price) {
        totalSpent += interaction.metadata.price;
      }
    });

    return {
      favoriteCategories: Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat]) => cat),
      favoriteBrands: Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([brand]) => brand),
      averageSpent: totalSpent / interactions.length || 0,
      totalInteractions: interactions.length
    };
  }

  /**
   * Analyze history implementation
   * @private
   */
  async _analyzeHistory(params) {
    const { userId, days = 30 } = params;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const interactions = await UserInteraction.find({
      user: userId,
      timestamp: { $gte: since }
    }).lean();

    const orders = await Order.find({
      user: userId,
      createdAt: { $gte: since }
    }).lean();

    return {
      interactionCount: interactions.length,
      orderCount: orders.length,
      totalSpent: orders.reduce((sum, order) => sum + (order.total || 0), 0),
      averageOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + (order.total || 0), 0) / orders.length : 0
    };
  }

  /**
   * Build PC configuration implementation
   * @private
   */
  async _buildPCConfiguration(params) {
    const { budget, purpose, preferences = {} } = params;

    // Simple implementation - will be enhanced by PCBuilderAdvisor
    return {
      budget,
      purpose,
      components: {},
      totalCost: 0,
      message: 'PC Builder not fully implemented yet - will be handled by PCBuilderAgent'
    };
  }

  /**
   * Check compatibility implementation
   * @private
   */
  async _checkCompatibility(params) {
    const { components } = params;

    return {
      compatible: true,
      issues: [],
      warnings: []
    };
  }

  /**
   * Strict rule-based compatibility logic.
   * Independent from RAG/LLM for deterministic hardware validation.
   *
   * Input shape:
   * {
   *   cpu: { name: string, socket: string },
   *   motherboard: { name: string, socket: string, supportedRamBus: number[] | string[] },
   *   ram: { name: string, bus: number | string }
   * }
   */
  async _pcCompatibilityCheck(params) {
    try {
      const cpu = params?.cpu || {};
      const mainboard = params?.mainboard || params?.motherboard || {};
      const ram = params?.ram || {};

      const socketResult = PCBuildTool.checkSocketCompatibility(cpu, mainboard);
      const ramBusResult = PCBuildTool.checkRamBus(cpu, mainboard, ram);

      const reasons = [];
      if (!socketResult.compatible) {
        const socketDetail = socketResult.details || {};
        if (String(socketResult.reason || '').toLowerCase().includes('missing')) {
          reasons.push('Thiếu thông tin socket của CPU hoặc Mainboard.');
        } else {
          reasons.push(`Socket không tương thích: CPU=${socketDetail.cpuSocket || 'N/A'}, Mainboard=${socketDetail.mainboardSocket || 'N/A'}.`);
        }
      }
      if (!ramBusResult.compatible) {
        const ramDetail = ramBusResult.details || {};
        if (String(ramBusResult.reason || '').toLowerCase().includes('missing')) {
          reasons.push('Thiếu thông tin bus RAM hoặc danh sách bus hỗ trợ của Mainboard.');
        } else {
          const supported = Array.isArray(ramDetail.boardSupported) ? ramDetail.boardSupported.join(', ') : 'N/A';
          reasons.push(`Bus RAM không tương thích: RAM=${ramDetail.ramBus || 'N/A'}MHz, Mainboard hỗ trợ=${supported}MHz.`);
        }
      }

      const warnings = [];
      if (String(socketResult.reason || '').toLowerCase().includes('missing')) {
        warnings.push(socketResult.reason);
      }
      if (String(ramBusResult.reason || '').toLowerCase().includes('missing')) {
        warnings.push(ramBusResult.reason);
      }

      return {
        compatible: reasons.length === 0,
        reasons,
        warnings,
        checked: {
          cpu: socketResult.details?.cpuSocket ? { name: cpu.name || 'N/A', socket: socketResult.details.cpuSocket } : { name: cpu.name || 'N/A', socket: null },
          mainboard: {
            name: mainboard.name || 'N/A',
            socket: socketResult.details?.mainboardSocket || null,
            supportedRamBus: ramBusResult.details?.boardSupported || []
          },
          ram: { name: ram.name || 'N/A', bus: ramBusResult.details?.ramBus || null }
        }
      };
    } catch (error) {
      return {
        compatible: false,
        reasons: [`Lỗi xử lý compatibility: ${error.message}`],
        warnings: [],
        checked: null
      };
    }
  }

  /**
   * Suggest alternatives implementation
   * @private
   */
  async _suggestAlternatives(params) {
    const { component, reason } = params;

    return {
      alternatives: [],
      reason
    };
  }

  getPCToolSchema() {
    return PCBuildTool.TOOL_SCHEMA;
  }

  _normalizeSocket(value) {
    if (!value || typeof value !== 'string') {
      return '';
    }
    return value.trim().toUpperCase().replace(/\s+/g, '');
  }

  _normalizeBusValue(value) {
    if (value === undefined || value === null) {
      return null;
    }

    const numeric = Number(String(value).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }

    return Math.round(numeric);
  }

  _normalizeBusList(list) {
    if (!Array.isArray(list)) {
      return [];
    }

    const normalized = list
      .map((value) => this._normalizeBusValue(value))
      .filter((value) => value !== null);

    return [...new Set(normalized)].sort((a, b) => a - b);
  }

  /**
   * Search knowledge implementation
   * @private
   */
  async _searchKnowledge(params) {
    const { query, category } = params;

    // Knowledge base would be expanded
    return {
      query,
      results: [],
      message: 'Knowledge base not fully populated - will be handled by KnowledgeAgent'
    };
  }

  /**
   * Generate explanation implementation
   * @private
   */
  async _generateExplanation(params) {
    const { concept, detail = 'medium' } = params;

    return {
      concept,
      explanation: `Explanation for ${concept} will be generated by KnowledgeAgent`,
 detail
    };
  }

  /**
   * Analyze specs implementation
   * @private
   */
  async _analyzeSpecs(params) {
    const { productId, purpose } = params;

    const product = await Product.findById(productId).lean();

    if (!product) {
      throw new Error('Product not found');
    }

    return {
      product: product.name,
      specifications: product.specifications,
      analysis: 'Spec analysis will be enhanced by AI',
      purpose
    };
  }

  /**
   * Get similar products implementation
   * @private
   */
  async _getSimilarProducts(params) {
    const { productId, limit = 5 } = params;

    const product = await Product.findById(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    const similar = await Product.find({
      category: product.category,
      _id: { $ne: productId },
      stock: { $gt: 0 }
    })
      .sort({ rating: -1 })
      .limit(limit)
      .lean();

    return similar;
  }
}

module.exports = new ToolSystem();
