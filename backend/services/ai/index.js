/**
 * AI Index - Export all AI services
 * 
 * @module services/ai
 * @description Central export point for all AI services
 */

const RecommendationService = require('./RecommendationService');
const SemanticSearchService = require('./SemanticSearchService');
const ReviewAnalysisService = require('./ReviewAnalysisService');
const SalesForecastingService = require('./SalesForecastingService');
const ChatbotService = require('./ChatbotService');
const ModelEvaluationService = require('./ModelEvaluationService');

module.exports = {
  RecommendationService,
  SemanticSearchService,
  ReviewAnalysisService,
  SalesForecastingService,
  ChatbotService,
  ModelEvaluationService
};
