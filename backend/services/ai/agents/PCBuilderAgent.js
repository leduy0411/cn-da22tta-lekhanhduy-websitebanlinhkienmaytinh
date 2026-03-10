/**
 * PC Builder Agent
 * Builds complete PC configurations with compatibility checking
 * 
 * @module services/ai/agents/PCBuilderAgent
 * @description Specialized agent for PC building with compatibility rules
 */

const ToolSystem = require('../core/ToolSystem');
const Product = require('../../../models/Product');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class PCBuilderAgent {
  constructor() {
    this.name = 'PCBuilderAgent';
    this.capabilities = ['pc_build', 'compatibility_check', 'component_selection'];
    
    // Initialize Gemini
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.gemini.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      });
    }

    // Compatibility rules
    this.compatibilityRules = {
      cpu_socket: {
        'Intel 12th/13th/14th Gen': 'LGA1700',
        'Intel 10th/11th Gen': 'LGA1200',
        'AMD Ryzen 7000': 'AM5',
        'AMD Ryzen 5000': 'AM4',
        'AMD Ryzen 3000': 'AM4'
      },
      
      ram_type: {
        'LGA1700': 'DDR5',
        'LGA1200': 'DDR4',
        'AM5': 'DDR5',
        'AM4': 'DDR4'
      },

      gpu_power: {
        'RTX 4090': 450,
        'RTX 4080': 320,
        'RTX 4070 Ti': 285,
        'RTX 4070': 200,
        'RTX 4060 Ti': 160,
        'RTX 4060': 115,
        'RX 7900 XTX': 355,
        'RX 7900 XT': 300,
        'RX 7800 XT': 263
      },

      psu_recommendation: {
        '<150W': 450,
        '150-200W': 550,
        '200-300W': 650,
        '300-400W': 750,
        '>400W': 850
      }
    };

    // Budget allocation strategies
    this.budgetAllocation = {
      gaming: {
        cpu: 0.25,
        gpu: 0.40,
        motherboard: 0.10,
        ram: 0.10,
        storage: 0.08,
        psu: 0.05,
        case: 0.02
      },
      workstation: {
        cpu: 0.35,
        gpu: 0.25,
        motherboard: 0.12,
        ram: 0.15,
        storage: 0.08,
        psu: 0.03,
        case: 0.02
      },
      office: {
        cpu: 0.30,
        gpu: 0.15,
        motherboard: 0.15,
        ram: 0.15,
        storage: 0.15,
        psu: 0.05,
        case: 0.05
      }
    };
  }

  /**
   * Execute agent logic
   * @param {Object} params - Execution parameters
   * @returns {Promise<Object>} Agent response
   */
  async execute(params) {
    const { message, intent, plan, context } = params;
    const entities = intent.entities;

    try {
      console.log(`🖥️ PCBuilderAgent executing for: ${message}`);

      // Extract build parameters
      const buildParams = {
        budget: entities.price?.max || entities.price?.exact || 30000000,
        purpose: entities.purpose || 'gaming',
        preferences: entities.brand ? { brands: entities.brand } : {}
      };

      console.log('Build parameters:', buildParams);

      // Build PC configuration
      const configuration = await this._buildConfiguration(buildParams);

      // Check compatibility
      const compatibilityCheck = this._checkCompatibility(configuration);

      // Generate alternatives if needed
      if (!compatibilityCheck.compatible) {
        configuration.alternatives = await this._generateAlternatives(configuration, compatibilityCheck.issues);
      }

      // Generate AI response
      const aiResponse = await this._generateResponse(
        message,
        configuration,
        compatibilityCheck,
        buildParams
      );

      return {
        answer: aiResponse,
        configuration,
        compatibility: compatibilityCheck,
        totalCost: configuration.totalCost,
        intent: intent.intent,
        source: 'PCBuilderAgent',
        metadata: {
          budget: buildParams.budget,
          purpose: buildParams.purpose,
          compatible: compatibilityCheck.compatible
        }
      };

    } catch (error) {
      console.error('PCBuilderAgent error:', error);
      
      return {
        answer: this._getFallbackResponse(message, entities),
        configuration: null,
        intent: intent.intent,
        source: 'PCBuilderAgent_Fallback',
        error: error.message
      };
    }
  }

  /**
   * Build PC configuration
   * @private
   */
  async _buildConfiguration(params) {
    const { budget, purpose, preferences } = params;
    
    // Get budget allocation
    const allocation = this.budgetAllocation[purpose] || this.budgetAllocation.gaming;

    const configuration = {
      purpose,
      budget,
      components: {},
      totalCost: 0
    };

    // 1. Select CPU
    configuration.components.cpu = await this._selectCPU(
      budget * allocation.cpu,
      purpose,
      preferences
    );

    // 2. Select GPU
    configuration.components.gpu = await this._selectGPU(
      budget * allocation.gpu,
      purpose,
      preferences
    );

    // 3. Select Motherboard (compatible with CPU)
    configuration.components.motherboard = await this._selectMotherboard(
      budget * allocation.motherboard,
      configuration.components.cpu,
      preferences
    );

    // 4. Select RAM (compatible with motherboard)
    configuration.components.ram = await this._selectRAM(
      budget * allocation.ram,
      configuration.components.motherboard,
      purpose
    );

    // 5. Select Storage
    configuration.components.storage = await this._selectStorage(
      budget * allocation.storage,
      purpose
    );

    // 6. Select PSU (based on GPU power)
    configuration.components.psu = await this._selectPSU(
      budget * allocation.psu,
      configuration.components.gpu
    );

    // 7. Select Case
    configuration.components.case = await this._selectCase(
      budget * allocation.case,
      preferences
    );

    // Calculate total cost
    configuration.totalCost = Object.values(configuration.components).reduce(
      (sum, component) => sum + (component?.price || 0),
      0
    );

    // Budget difference
    configuration.budgetDifference = budget - configuration.totalCost;
    configuration.withinBudget = configuration.totalCost <= budget;

    return configuration;
  }

  /**
   * Select CPU
   * @private
   */
  async _selectCPU(budget, purpose, preferences) {
    const queries = {
      gaming: ['i5', 'i7', 'Ryzen 5', 'Ryzen 7'],
      workstation: ['i7', 'i9', 'Ryzen 7', 'Ryzen 9'],
      office: ['i3', 'i5', 'Ryzen 3', 'Ryzen 5']
    };

    const searchQuery = queries[purpose] || queries.gaming;

    for (const query of searchQuery) {
      const result = await Product.findOne({
        category: /cpu|processor/i,
        name: new RegExp(query, 'i'),
        price: { $lte: budget * 1.1, $gte: budget * 0.7 },
        stock: { $gt: 0 }
      })
        .sort({ rating: -1, price: -1 })
        .lean();

      if (result) {
        return {
          id: result._id,
          name: result.name,
          price: result.price,
          brand: result.brand,
          socket: this._extractSocket(result.name),
          specs: result.specifications
        };
      }
    }

    return null;
  }

  /**
   * Select GPU
   * @private
   */
  async _selectGPU(budget, purpose, preferences) {
    const queries = {
      gaming: ['RTX 4070', 'RTX 4060', 'RX 7800', 'RX 7700'],
      workstation: ['RTX 4080', 'RTX 4070', 'RTX 4060'],
      office: ['GTX 1650', 'GTX 1660']
    };

    const searchQuery = queries[purpose] || queries.gaming;

    for (const query of searchQuery) {
      const result = await Product.findOne({
        category: /gpu|vga|graphics/i,
        name: new RegExp(query, 'i'),
        price: { $lte: budget * 1.1, $gte: budget * 0.7 },
        stock: { $gt: 0 }
      })
        .sort({ rating: -1, price: -1 })
        .lean();

      if (result) {
        return {
          id: result._id,
          name: result.name,
          price: result.price,
          brand: result.brand,
          power: this._estimateGPUPower(result.name),
          specs: result.specifications
        };
      }
    }

    return null;
  }

  /**
   * Select Motherboard
   * @private
   */
  async _selectMotherboard(budget, cpu, preferences) {
    if (!cpu) return null;

    const socket = cpu.socket;

    const result = await Product.findOne({
      category: /motherboard|mainboard/i,
      $or: [
        { name: new RegExp(socket, 'i') },
        { 'specifications.socket': new RegExp(socket, 'i') }
      ],
      price: { $lte: budget * 1.2, $gte: budget * 0.6 },
      stock: { $gt: 0 }
    })
      .sort({ rating: -1 })
      .lean();

    if (result) {
      return {
        id: result._id,
        name: result.name,
        price: result.price,
        brand: result.brand,
        socket,
        ramType: this.compatibilityRules.ram_type[socket] || 'DDR4',
        specs: result.specifications
      };
    }

    return null;
  }

  /**
   * Select RAM
   * @private
   */
  async _selectRAM(budget, motherboard, purpose) {
    if (!motherboard) return null;

    const ramType = motherboard.ramType;
    const capacities = {
      gaming: ['16GB', '32GB'],
      workstation: ['32GB', '64GB'],
      office: ['8GB', '16GB']
    };

    const targetCapacity = capacities[purpose] || capacities.gaming;

    for (const capacity of targetCapacity) {
      const result = await Product.findOne({
        category: /ram|memory/i,
        name: new RegExp(`${ramType}.*${capacity}`, 'i'),
        price: { $lte: budget * 1.2 },
        stock: { $gt: 0 }
      })
        .sort({ rating: -1 })
        .lean();

      if (result) {
        return {
          id: result._id,
          name: result.name,
          price: result.price,
          brand: result.brand,
          type: ramType,
          capacity,
          specs: result.specifications
        };
      }
    }

    return null;
  }

  /**
   * Select Storage
   * @private
   */
  async _selectStorage(budget, purpose) {
    const capacities = ['1TB', '512GB', '2TB'];

    for (const capacity of capacities) {
      const result = await Product.findOne({
        category: /ssd/i,
        name: new RegExp(`${capacity}.*NVMe|M.2`, 'i'),
        price: { $lte: budget * 1.2 },
        stock: { $gt: 0 }
      })
        .sort({ rating: -1 })
        .lean();

      if (result) {
        return {
          id: result._id,
          name: result.name,
          price: result.price,
          brand: result.brand,
          capacity,
          type: 'NVMe SSD',
          specs: result.specifications
        };
      }
    }

    return null;
  }

  /**
   * Select PSU
   * @private
   */
  async _selectPSU(budget, gpu) {
    const gpuPower = gpu?.power || 200;
    const totalPower = gpuPower + 150; // CPU + other components
    const recommendedWattage = Math.ceil(totalPower / 50) * 50 + 100; // Round up + headroom

    const wattages = [recommendedWattage, recommendedWattage + 100, recommendedWattage - 100];

    for (const wattage of wattages) {
      const result = await Product.findOne({
        category: /psu|power supply/i,
        name: new RegExp(`${wattage}W`, 'i'),
        price: { $lte: budget * 1.5 },
        stock: { $gt: 0 }
      })
        .sort({ rating: -1 })
        .lean();

      if (result) {
        return {
          id: result._id,
          name: result.name,
          price: result.price,
          brand: result.brand,
          wattage: `${wattage}W`,
          specs: result.specifications
        };
      }
    }

    return null;
  }

  /**
   * Select Case
   * @private
   */
  async _selectCase(budget, preferences) {
    const result = await Product.findOne({
      category: /case|chassis/i,
      price: { $lte: budget * 1.5 },
      stock: { $gt: 0 }
    })
      .sort({ rating: -1 })
      .lean();

    if (result) {
      return {
        id: result._id,
        name: result.name,
        price: result.price,
        brand: result.brand,
        specs: result.specifications
      };
    }

    return null;
  }

  /**
   * Check configuration compatibility
   * @private
   */
  _checkCompatibility(configuration) {
    const issues = [];
    const warnings = [];

    const { cpu, gpu, motherboard, ram, psu } = configuration.components;

    // Check CPU - Motherboard socket compatibility
    if (cpu && motherboard) {
      if (cpu.socket !== motherboard.socket) {
        issues.push(`CPU socket (${cpu.socket}) không tương thích với motherboard socket (${motherboard.socket})`);
      }
    }

    // Check RAM type compatibility
    if (ram && motherboard) {
      if (ram.type !== motherboard.ramType) {
        issues.push(`RAM ${ram.type} không tương thích với motherboard hỗ trợ ${motherboard.ramType}`);
      }
    }

    // Check PSU wattage
    if (psu && gpu) {
      const psuWattage = parseInt(psu.wattage) || 0;
      const gpuPower = gpu.power || 0;
      const totalPower = gpuPower + 150;

      if (psuWattage < totalPower) {
        issues.push(`PSU ${psu.wattage} không đủ công suất (cần tối thiểu ${totalPower}W)`);
      } else if (psuWattage < totalPower * 1.2) {
        warnings.push(`PSU ${psu.wattage} đủ nhưng khuyến nghị dùng PSU lớn hơn`);
      }
    }

    // Check if all components selected
    const missingComponents = [];
    ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case'].forEach(component => {
      if (!configuration.components[component]) {
        missingComponents.push(component);
      }
    });

    if (missingComponents.length > 0) {
      warnings.push(`Một số linh kiện chưa được chọn: ${missingComponents.join(', ')}`);
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings,
      checkedAt: new Date()
    };
  }

  /**
   * Generate alternatives if incompatible
   * @private
   */
  async _generateAlternatives(configuration, issues) {
    // Simple alternative generation - in production this would be more sophisticated
    return {
      message: 'Đang tìm linh kiện thay thế tương thích...',
      alternatives: []
    };
  }

  /**
   * Extract CPU socket from name
   * @private
   */
  _extractSocket(cpuName) {
    if (/i[3579]-1[234]\d{3}/i.test(cpuName)) return 'LGA1700';
    if (/i[3579]-1[01]\d{3}/i.test(cpuName)) return 'LGA1200';
    if (/Ryzen.*7000/i.test(cpuName)) return 'AM5';
    if (/Ryzen.*(5000|3000)/i.test(cpuName)) return 'AM4';
    return 'Unknown';
  }

  /**
   * Estimate GPU power consumption
   * @private
   */
  _estimateGPUPower(gpuName) {
    for (const [model, power] of Object.entries(this.compatibilityRules.gpu_power)) {
      if (gpuName.includes(model)) {
        return power;
      }
    }
    return 200; // Default estimate
  }

  /**
   * Generate AI response
   * @private
   */
  async _generateResponse(query, configuration, compatibility, buildParams) {
    if (!this.model) {
      return this._getFallbackResponse(query, configuration);
    }

    try {
      const componentsInfo = Object.entries(configuration.components)
        .filter(([, component]) => component !== null)
        .map(([type, component]) => `
**${type.toUpperCase()}:** ${component.name}
- Giá: ${component.price?.toLocaleString('vi-VN')} VND
- Thương hiệu: ${component.brand || 'N/A'}
        `).join('\n');

      const compatibilityInfo = compatibility.compatible
        ? '✅ Tất cả linh kiện tương thích'
        : `❌ Vấn đề tương thích:\n${compatibility.issues.map(i => `- ${i}`).join('\n')}`;

      const prompt = `Bạn là chuyên gia build PC tại TechStore.

Khách hàng yêu cầu: "${query}"
- Ngân sách: ${buildParams.budget.toLocaleString('vi-VN')} VND
- Mục đích: ${buildParams.purpose}

**Cấu hình đề xuất:**
${componentsInfo}

**Tổng chi phí:** ${configuration.totalCost.toLocaleString('vi-VN')} VND
**Còn lại:** ${configuration.budgetDifference.toLocaleString('vi-VN')} VND

**Tình trạng tương thích:**
${compatibilityInfo}

Hãy:
1. Giải thích lý do chọn từng linh kiện
2. Đánh giá hiệu năng tổng thể của cấu hình
3. Đề xuất nâng cấp (nếu còn ngân sách)
4. Cảnh báo nếu có vấn đề tương thích
5. Đưa ra lời khuyên cuối cùng

Trả lời bằng tiếng Việt, chi tiết và dễ hiểu.`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();

    } catch (error) {
      console.error('Gemini generation error:', error);
      return this._getFallbackResponse(query, configuration);
    }
  }

  /**
   * Fallback response
   * @private
   */
  _getFallbackResponse(query, configuration) {
    if (!configuration) {
      return '🖥️ Xin lỗi, tôi gặp khó khăn trong việc build PC với yêu cầu này. Vui lòng thử lại hoặc liên hệ hotline để được tư vấn trực tiếp.';
    }

    let response = '🖥️ **Cấu hình PC được đề xuất**\n\n';

    Object.entries(configuration.components).forEach(([type, component]) => {
      if (component) {
        response += `**${type.toUpperCase()}:** ${component.name} - ${component.price.toLocaleString('vi-VN')} VND\n`;
      }
    });

    response += `\n**Tổng chi phí:** ${configuration.totalCost.toLocaleString('vi-VN')} VND\n`;
    response += `**Ngân sách còn lại:** ${configuration.budgetDifference.toLocaleString('vi-VN')} VND\n`;

    return response;
  }
}

module.exports = new PCBuilderAgent();
