/**
 * Model Evaluation Service
 * Đánh giá performance của các ML models với Precision@K, Recall@K, F1-score
 * 
 * @module services/ai/ModelEvaluationService
 * @description AI Service cho Model Evaluation - Metrics để viết báo cáo đồ án
 */

const mongoose = require('mongoose');
const ModelEvaluation = require('../../models/ModelEvaluation');
const UserInteraction = require('../../models/UserInteraction');
const Product = require('../../models/Product');
const Review = require('../../models/Review');
const ReviewAnalysis = require('../../models/ReviewAnalysis');
const RecommendationService = require('./RecommendationService');
const SemanticSearchService = require('./SemanticSearchService');
const ReviewAnalysisService = require('./ReviewAnalysisService');

class ModelEvaluationService {
  constructor() {
    this.evaluationResults = new Map();
  }

  // ==================== RECOMMENDATION METRICS ====================

  /**
   * Tính Precision@K
   * Precision@K = (Số items relevant trong top K) / K
   */
  calculatePrecisionAtK(predictions, actualItems, k) {
    const topK = predictions.slice(0, k);
    const relevantInTopK = topK.filter(p => actualItems.includes(p)).length;
    return relevantInTopK / k;
  }

  /**
   * Tính Recall@K
   * Recall@K = (Số items relevant trong top K) / (Tổng số items relevant)
   */
  calculateRecallAtK(predictions, actualItems, k) {
    if (actualItems.length === 0) return 0;
    const topK = predictions.slice(0, k);
    const relevantInTopK = topK.filter(p => actualItems.includes(p)).length;
    return relevantInTopK / actualItems.length;
  }

  /**
   * Tính F1@K
   * F1@K = 2 * (Precision@K * Recall@K) / (Precision@K + Recall@K)
   */
  calculateF1AtK(precision, recall) {
    if (precision + recall === 0) return 0;
    return 2 * (precision * recall) / (precision + recall);
  }

  /**
   * Tính NDCG@K (Normalized Discounted Cumulative Gain)
   */
  calculateNDCG(predictions, actualItems, k) {
    const relevanceScores = predictions.slice(0, k).map(p => 
      actualItems.includes(p) ? 1 : 0
    );

    // DCG
    let dcg = 0;
    for (let i = 0; i < relevanceScores.length; i++) {
      dcg += relevanceScores[i] / Math.log2(i + 2);
    }

    // Ideal DCG
    const idealRelevance = new Array(Math.min(k, actualItems.length)).fill(1)
      .concat(new Array(Math.max(0, k - actualItems.length)).fill(0));
    
    let idcg = 0;
    for (let i = 0; i < idealRelevance.length; i++) {
      idcg += idealRelevance[i] / Math.log2(i + 2);
    }

    return idcg === 0 ? 0 : dcg / idcg;
  }

  /**
   * Tính Mean Reciprocal Rank (MRR)
   */
  calculateMRR(predictions, actualItems) {
    for (let i = 0; i < predictions.length; i++) {
      if (actualItems.includes(predictions[i])) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }

  /**
   * Tính Hit Rate@K
   */
  calculateHitRate(predictions, actualItems, k) {
    const topK = predictions.slice(0, k);
    return topK.some(p => actualItems.includes(p)) ? 1 : 0;
  }

  /**
   * Tính Coverage
   * Coverage = Số sản phẩm unique được recommend / Tổng số sản phẩm
   */
  async calculateCoverage(allRecommendations) {
    const totalProducts = await Product.countDocuments({ stock: { $gt: 0 } });
    const recommendedProducts = new Set(allRecommendations.flat());
    return recommendedProducts.size / totalProducts;
  }

  /**
   * Tính Diversity (Intra-list diversity)
   */
  calculateDiversity(recommendations) {
    if (recommendations.length < 2) return 0;
    
    const categories = recommendations.map(r => r.category);
    const uniqueCategories = new Set(categories);
    return uniqueCategories.size / categories.length;
  }

  // ==================== CLASSIFICATION METRICS ====================

  /**
   * Tính Confusion Matrix
   */
  calculateConfusionMatrix(predictions, actuals, labels) {
    const matrix = labels.map(() => labels.map(() => 0));
    const labelIndex = {};
    labels.forEach((label, i) => labelIndex[label] = i);

    predictions.forEach((pred, i) => {
      const actual = actuals[i];
      const predIdx = labelIndex[pred];
      const actualIdx = labelIndex[actual];
      if (predIdx !== undefined && actualIdx !== undefined) {
        matrix[actualIdx][predIdx]++;
      }
    });

    return matrix;
  }

  /**
   * Tính Classification Metrics từ Confusion Matrix
   */
  calculateClassificationMetrics(predictions, actuals, labels) {
    const confusionMatrix = this.calculateConfusionMatrix(predictions, actuals, labels);
    const results = {
      classes: [],
      confusionMatrix,
      confusionMatrixLabels: labels
    };

    let totalCorrect = 0;
    let totalSamples = predictions.length;
    let macroPrecision = 0, macroRecall = 0, macroF1 = 0;
    let weightedPrecision = 0, weightedRecall = 0, weightedF1 = 0;

    labels.forEach((label, i) => {
      // True Positives
      const tp = confusionMatrix[i][i];
      
      // False Positives (predicted as i but actually other)
      let fp = 0;
      for (let j = 0; j < labels.length; j++) {
        if (j !== i) fp += confusionMatrix[j][i];
      }
      
      // False Negatives (actually i but predicted as other)
      let fn = 0;
      for (let j = 0; j < labels.length; j++) {
        if (j !== i) fn += confusionMatrix[i][j];
      }

      // Support (actual count for this class)
      const support = confusionMatrix[i].reduce((a, b) => a + b, 0);

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

      results.classes.push({
        className: label,
        precision,
        recall,
        f1,
        support
      });

      totalCorrect += tp;
      macroPrecision += precision;
      macroRecall += recall;
      macroF1 += f1;
      weightedPrecision += precision * support;
      weightedRecall += recall * support;
      weightedF1 += f1 * support;
    });

    results.accuracy = totalCorrect / totalSamples;
    results.macroPrecision = macroPrecision / labels.length;
    results.macroRecall = macroRecall / labels.length;
    results.macroF1 = macroF1 / labels.length;
    results.weightedPrecision = weightedPrecision / totalSamples;
    results.weightedRecall = weightedRecall / totalSamples;
    results.weightedF1 = weightedF1 / totalSamples;

    return results;
  }

  // ==================== REGRESSION METRICS ====================

  /**
   * Tính Regression Metrics
   */
  calculateRegressionMetrics(predictions, actuals) {
    const n = predictions.length;
    let sumAbsError = 0, sumSquaredError = 0, sumAbsPercentError = 0;
    let sumActual = 0, sumSquaredActual = 0;

    for (let i = 0; i < n; i++) {
      const error = actuals[i] - predictions[i];
      sumAbsError += Math.abs(error);
      sumSquaredError += error * error;
      if (actuals[i] !== 0) {
        sumAbsPercentError += Math.abs(error / actuals[i]) * 100;
      }
      sumActual += actuals[i];
      sumSquaredActual += actuals[i] * actuals[i];
    }

    const mae = sumAbsError / n;
    const mse = sumSquaredError / n;
    const rmse = Math.sqrt(mse);
    const mape = sumAbsPercentError / n;

    // R-squared
    const meanActual = sumActual / n;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      ssTot += (actuals[i] - meanActual) ** 2;
    }
    const r2 = ssTot > 0 ? 1 - (sumSquaredError / ssTot) : 0;

    return { mae, mse, rmse, mape, r2 };
  }

  // ==================== EVALUATION METHODS ====================

  /**
   * Evaluate Recommendation Model
   */
  async evaluateRecommendationModel(modelName, options = {}) {
    const { testSize = 0.2, kValues = [5, 10, 20] } = options;
    console.log(`Evaluating recommendation model: ${modelName}...`);

    // Get user interaction data
    const interactionData = await UserInteraction.getInteractionMatrix({
      minInteractions: 3,
      interactionTypes: ['purchase', 'cart_add', 'review']
    });

    if (interactionData.length < 10) {
      console.log('Not enough data for evaluation');
      return null;
    }

    // Split into train/test
    const testUsers = interactionData.slice(0, Math.floor(interactionData.length * testSize));
    
    const metrics = {
      precisionAtK: { k5: 0, k10: 0, k20: 0 },
      recallAtK: { k5: 0, k10: 0, k20: 0 },
      f1AtK: { k5: 0, k10: 0, k20: 0 },
      ndcg: { k5: 0, k10: 0, k20: 0 },
      mrr: 0,
      hitRate: { k5: 0, k10: 0, k20: 0 }
    };

    let evaluatedUsers = 0;
    const allRecommendations = [];

    for (const userData of testUsers) {
      try {
        // Get actual items (held-out items for this user)
        const actualItems = userData.interactions
          .slice(Math.floor(userData.interactions.length * 0.8))
          .map(i => i.product.toString());

        if (actualItems.length === 0) continue;

        // Get recommendations
        let recommendations = [];
        switch (modelName) {
          case 'user-based-cf':
            recommendations = await RecommendationService.getUserBasedCF(userData._id, { limit: 20 });
            break;
          case 'item-based-cf':
            const seedProduct = userData.interactions[0]?.product;
            if (seedProduct) {
              recommendations = await RecommendationService.getItemBasedCF(seedProduct, { limit: 20 });
            }
            break;
          case 'content-based-filtering':
            const product = userData.interactions[0]?.product;
            if (product) {
              recommendations = await RecommendationService.getContentBasedRecommendations(product, { limit: 20 });
            }
            break;
          case 'hybrid-recommendation':
            const productId = userData.interactions[0]?.product;
            recommendations = await RecommendationService.getHybridRecommendations(userData._id, productId, { limit: 20 });
            break;
          default:
            recommendations = await RecommendationService.getRuleBasedRecommendations(
              userData.interactions[0]?.product, { limit: 20 }
            );
        }

        const predictedIds = recommendations.map(r => (r._id || r.productId)?.toString()).filter(Boolean);
        allRecommendations.push(predictedIds);

        // Calculate metrics for each K
        for (const k of kValues) {
          const kKey = `k${k}`;
          const precision = this.calculatePrecisionAtK(predictedIds, actualItems, k);
          const recall = this.calculateRecallAtK(predictedIds, actualItems, k);
          
          metrics.precisionAtK[kKey] += precision;
          metrics.recallAtK[kKey] += recall;
          metrics.f1AtK[kKey] += this.calculateF1AtK(precision, recall);
          metrics.ndcg[kKey] += this.calculateNDCG(predictedIds, actualItems, k);
          metrics.hitRate[kKey] += this.calculateHitRate(predictedIds, actualItems, k);
        }

        metrics.mrr += this.calculateMRR(predictedIds, actualItems);
        evaluatedUsers++;

      } catch (err) {
        console.error(`Error evaluating user ${userData._id}:`, err.message);
      }
    }

    // Average metrics
    if (evaluatedUsers > 0) {
      for (const k of kValues) {
        const kKey = `k${k}`;
        metrics.precisionAtK[kKey] /= evaluatedUsers;
        metrics.recallAtK[kKey] /= evaluatedUsers;
        metrics.f1AtK[kKey] /= evaluatedUsers;
        metrics.ndcg[kKey] /= evaluatedUsers;
        metrics.hitRate[kKey] /= evaluatedUsers;
      }
      metrics.mrr /= evaluatedUsers;
    }

    // Calculate coverage and diversity
    metrics.coverage = await this.calculateCoverage(allRecommendations);
    metrics.diversity = allRecommendations.length > 0 
      ? allRecommendations.reduce((sum, recs) => {
          const products = recs.map(id => ({ category: 'unknown' })); // Simplified
          return sum + this.calculateDiversity(products);
        }, 0) / allRecommendations.length
      : 0;

    // Save evaluation
    const evaluation = await this.saveEvaluation(modelName, 'recommendation', {
      recommendationMetrics: metrics,
      dataset: {
        totalSamples: interactionData.length,
        testSamples: testUsers.length,
        trainTestSplit: 1 - testSize
      }
    });

    return evaluation;
  }

  /**
   * Evaluate Sentiment Analysis Model
   */
  async evaluateSentimentModel(modelName = 'rule-based-sentiment', options = {}) {
    console.log(`Evaluating sentiment model: ${modelName}...`);

    // Get reviews with known sentiment (from ratings)
    const reviews = await Review.find({
      rating: { $exists: true },
      comment: { $exists: true, $ne: '' }
    }).limit(1000);

    if (reviews.length < 50) {
      console.log('Not enough reviews for evaluation');
      return null;
    }

    const predictions = [];
    const actuals = [];
    const labels = ['positive', 'neutral', 'negative'];

    for (const review of reviews) {
      // Ground truth from rating
      let actualLabel;
      if (review.rating >= 4) actualLabel = 'positive';
      else if (review.rating <= 2) actualLabel = 'negative';
      else actualLabel = 'neutral';

      // Prediction from model
      const sentiment = ReviewAnalysisService.analyzeSentiment(review.comment, review.rating);
      
      predictions.push(sentiment.label);
      actuals.push(actualLabel);
    }

    const metrics = this.calculateClassificationMetrics(predictions, actuals, labels);

    // Save evaluation
    const evaluation = await this.saveEvaluation(modelName, 'nlp', {
      classificationMetrics: metrics,
      dataset: {
        totalSamples: reviews.length,
        description: 'Reviews with rating-based ground truth'
      }
    });

    return evaluation;
  }

  /**
   * Evaluate Search Model
   */
  async evaluateSearchModel(modelName = 'tfidf-search', options = {}) {
    console.log(`Evaluating search model: ${modelName}...`);

    // Create test queries from product names
    const products = await Product.find({ stock: { $gt: 0 } })
      .select('name category brand')
      .limit(100);

    if (products.length < 20) {
      console.log('Not enough products for evaluation');
      return null;
    }

    let totalMRR = 0;
    let totalHitRate = 0;
    let totalLatency = 0;
    let evaluated = 0;

    for (const product of products) {
      // Create query from product name (first 2-3 words)
      const words = product.name.split(' ').slice(0, 3).join(' ');
      
      const startTime = Date.now();
      
      try {
        let results;
        switch (modelName) {
          case 'semantic-search':
            results = await SemanticSearchService.searchWithEmbeddings(words, { limit: 10 });
            break;
          case 'hybrid-search':
            results = await SemanticSearchService.hybridSearch(words, { limit: 10 });
            break;
          default:
            results = await SemanticSearchService.searchTFIDF(words, { limit: 10 });
        }

        const latency = Date.now() - startTime;
        totalLatency += latency;

        const resultIds = results.map(r => r.product?._id?.toString()).filter(Boolean);
        const expectedId = product._id.toString();

        // Calculate MRR
        const rank = resultIds.indexOf(expectedId);
        if (rank !== -1) {
          totalMRR += 1 / (rank + 1);
          totalHitRate += 1;
        }

        evaluated++;
      } catch (err) {
        console.error(`Error evaluating query "${words}":`, err.message);
      }
    }

    const metrics = {
      mrr: evaluated > 0 ? totalMRR / evaluated : 0,
      hitRate: evaluated > 0 ? totalHitRate / evaluated : 0,
      avgQueryLatency: evaluated > 0 ? totalLatency / evaluated : 0
    };

    // Save evaluation
    const evaluation = await this.saveEvaluation(modelName, 'search', {
      searchMetrics: metrics,
      dataset: {
        totalSamples: products.length,
        testSamples: evaluated,
        description: 'Product name queries'
      }
    });

    return evaluation;
  }

  /**
   * Cross-validation
   */
  async crossValidate(modelName, modelType, k = 5) {
    console.log(`Running ${k}-fold cross-validation for ${modelName}...`);

    const scores = [];

    for (let fold = 0; fold < k; fold++) {
      console.log(`  Fold ${fold + 1}/${k}`);
      
      let score;
      switch (modelType) {
        case 'recommendation':
          const recEval = await this.evaluateRecommendationModel(modelName, { testSize: 0.2 });
          score = recEval?.recommendationMetrics?.f1AtK?.k10 || 0;
          break;
        case 'nlp':
          const nlpEval = await this.evaluateSentimentModel(modelName);
          score = nlpEval?.classificationMetrics?.macroF1 || 0;
          break;
        case 'search':
          const searchEval = await this.evaluateSearchModel(modelName);
          score = searchEval?.searchMetrics?.mrr || 0;
          break;
        default:
          score = 0;
      }

      scores.push(score);
    }

    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - meanScore, 2), 0) / scores.length;
    const stdScore = Math.sqrt(variance);

    return {
      folds: k,
      scores,
      meanScore,
      stdScore
    };
  }

  // ==================== SAVE & REPORTING ====================

  /**
   * Save evaluation to database
   */
  async saveEvaluation(modelName, modelType, data) {
    const version = await this.getNextVersion(modelName);

    const evaluation = new ModelEvaluation({
      modelName,
      modelType,
      version,
      ...data,
      evaluatedAt: new Date(),
      status: 'completed'
    });

    await evaluation.save();
    return evaluation;
  }

  /**
   * Get next version number
   */
  async getNextVersion(modelName) {
    const lastEval = await ModelEvaluation.findOne({ modelName })
      .sort({ version: -1 })
      .select('version');

    if (!lastEval) return '1.0.0';

    const parts = lastEval.version.split('.').map(Number);
    parts[2]++;
    return parts.join('.');
  }

  /**
   * Generate report for thesis
   */
  async generateThesisReport(modelNames = null) {
    const query = modelNames ? { modelName: { $in: modelNames } } : {};
    const evaluations = await ModelEvaluation.find(query)
      .sort({ evaluatedAt: -1 });

    const report = {
      title: 'Đánh giá các mô hình AI/ML trong hệ thống TechStore',
      generatedAt: new Date(),
      models: {}
    };

    for (const evaluation of evaluations) {
      const summary = evaluation.generateReportSummary();
      
      if (!report.models[evaluation.modelType]) {
        report.models[evaluation.modelType] = [];
      }
      
      report.models[evaluation.modelType].push(summary);
    }

    // Add comparison tables
    report.comparisons = {};

    // Recommendation models comparison
    const recModels = evaluations.filter(e => e.modelType === 'recommendation');
    if (recModels.length > 1) {
      report.comparisons.recommendation = {
        title: 'So sánh các phương pháp Recommendation',
        headers: ['Model', 'P@10', 'R@10', 'F1@10', 'NDCG@10', 'MRR', 'Coverage'],
        rows: recModels.map(e => [
          e.modelName,
          (e.recommendationMetrics?.precisionAtK?.k10 || 0).toFixed(4),
          (e.recommendationMetrics?.recallAtK?.k10 || 0).toFixed(4),
          (e.recommendationMetrics?.f1AtK?.k10 || 0).toFixed(4),
          (e.recommendationMetrics?.ndcg?.k10 || 0).toFixed(4),
          (e.recommendationMetrics?.mrr || 0).toFixed(4),
          (e.recommendationMetrics?.coverage || 0).toFixed(4)
        ])
      };
    }

    return report;
  }

  /**
   * Run all evaluations
   */
  async runAllEvaluations() {
    console.log('=== Starting Full Model Evaluation ===\n');
    const results = {};

    // Recommendation models
    console.log('1. Evaluating Recommendation Models...');
    const recModels = ['rule-based-recommendation', 'user-based-cf', 'item-based-cf', 'hybrid-recommendation'];
    for (const model of recModels) {
      try {
        results[model] = await this.evaluateRecommendationModel(model);
        console.log(`   ✓ ${model} completed`);
      } catch (err) {
        console.log(`   ✗ ${model} failed: ${err.message}`);
      }
    }

    // Sentiment model
    console.log('\n2. Evaluating Sentiment Model...');
    try {
      results['rule-based-sentiment'] = await this.evaluateSentimentModel('rule-based-sentiment');
      console.log('   ✓ rule-based-sentiment completed');
    } catch (err) {
      console.log(`   ✗ Failed: ${err.message}`);
    }

    // Search models
    console.log('\n3. Evaluating Search Models...');
    const searchModels = ['tfidf-search', 'hybrid-search'];
    for (const model of searchModels) {
      try {
        results[model] = await this.evaluateSearchModel(model);
        console.log(`   ✓ ${model} completed`);
      } catch (err) {
        console.log(`   ✗ ${model} failed: ${err.message}`);
      }
    }

    console.log('\n=== Evaluation Complete ===');
    
    // Generate summary report
    const report = await this.generateThesisReport();
    results.report = report;

    return results;
  }
}

module.exports = new ModelEvaluationService();
