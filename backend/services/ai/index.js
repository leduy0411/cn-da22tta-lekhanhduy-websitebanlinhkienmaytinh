/**
 * AI Index - Export all AI services
 * 
 * @module services/ai
 * @description Central export point for all AI services
 * @version 2.0 - Removed chat services (moved to GeminiChatService.js)
 */

const RecommendationService = require('./RecommendationService');
const SemanticSearchService = require('./SemanticSearchService');
const ReviewAnalysisService = require('./ReviewAnalysisService');

module.exports = {
  RecommendationService,
  SemanticSearchService,
  ReviewAnalysisService
};
