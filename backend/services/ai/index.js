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
const GeminiService = require('./GeminiService');
const AIServiceClient = require('./AIServiceClient');

module.exports = {
  RecommendationService,
  SemanticSearchService,
  ReviewAnalysisService,
  SalesForecastingService,
  ChatbotService,
  ModelEvaluationService,
  GeminiService,
  AIServiceClient
};
