/**
 * AI Service Client (Stub)
 * ════════════════════════════════════════════════════════════════
 * Stub cho AIServiceClient - trả về không có service available
 * Các routes sẽ fallback sang NodeJS services
 * 
 * @version 2.0 - Stub only (Python AI service removed)
 */

class AIServiceClient {
  /**
   * Check if Python AI service is available
   * @returns {Promise<boolean>} Always false (service removed)
   */
  static async isServiceAvailable() {
    return false;
  }

  /**
   * Get model status
   * @returns {Promise<Object>}
   */
  static async getModelStatus() {
    return {
      available: false,
      message: 'Python AI service removed - using direct NodeJS services'
    };
  }

  /**
   * Track interaction (no-op)
   */
  static async trackInteraction() {
    return { success: true };
  }

  /**
   * Trigger training (no-op)
   */
  static async triggerTraining() {
    return {
      success: false,
      message: 'Training endpoint disabled'
    };
  }

  /**
   * Get training report (stub)
   */
  static async getTrainingReport() {
    return {
      available: false,
      message: 'Training reports not available'
    };
  }

  /**
   * Get A/B variants (stub)
   */
  static getABVariants() {
    return [];
  }

  /**
   * Get training history (stub)
   */
  static async getTrainingHistory() {
    return [];
  }

  /**
   * Get model metrics (stub)
   */
  static async getModelMetrics() {
    return {
      available: false
    };
  }

  // ============ Recommendation methods (all return null/false) ============
  
  static async getUserRecommendations() {
    return null;
  }

  static async getProductRecommendations() {
    return null;
  }

  static async getCartRecommendations() {
    return null;
  }

  static async getTrending() {
    return null;
  }

  static async getFrequentlyBoughtTogether() {
    return null;
  }
}

module.exports = AIServiceClient;
