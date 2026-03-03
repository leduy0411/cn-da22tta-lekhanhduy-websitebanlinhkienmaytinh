/**
 * ModelEvaluation Model
 * Lưu trữ kết quả đánh giá các ML models
 * 
 * @module models/ModelEvaluation
 * @description Schema cho Model Evaluation - Metrics để viết báo cáo đồ án
 */
const mongoose = require('mongoose');

const modelEvaluationSchema = new mongoose.Schema({
  // Tên model
  modelName: {
    type: String,
    required: true,
    enum: [
      // Recommendation models
      'rule-based-recommendation',
      'user-based-cf',
      'item-based-cf',
      'content-based-filtering',
      'hybrid-recommendation',
      // Search models
      'tfidf-search',
      'semantic-search',
      'bm25-search',
      // NLP models
      'rule-based-sentiment',
      'naive-bayes-sentiment',
      'svm-sentiment',
      'lstm-sentiment',
      'bert-sentiment',
      'spam-detector',
      // Forecasting models
      'moving-average',
      'exponential-smoothing',
      'linear-regression',
      'arima',
      'sarima',
      'prophet',
      'lstm-forecast',
      // Chatbot models
      'intent-classifier',
      'entity-extractor',
      'response-generator'
    ],
    index: true
  },

  // Loại model
  modelType: {
    type: String,
    required: true,
    enum: ['recommendation', 'search', 'nlp', 'forecasting', 'chatbot'],
    index: true
  },

  // Version
  version: {
    type: String,
    required: true,
    default: '1.0.0'
  },

  // === EVALUATION DATASET ===
  dataset: {
    name: String,
    description: String,
    totalSamples: { type: Number, default: 0 },
    trainingSamples: { type: Number, default: 0 },
    validationSamples: { type: Number, default: 0 },
    testSamples: { type: Number, default: 0 },
    trainTestSplit: { type: Number, default: 0.8 },
    features: [String],
    dateRange: {
      start: Date,
      end: Date
    }
  },

  // === RECOMMENDATION METRICS ===
  recommendationMetrics: {
    // Precision@K - Tỷ lệ items relevant trong K items được recommend
    precisionAtK: {
      k5: { type: Number, default: 0 },
      k10: { type: Number, default: 0 },
      k20: { type: Number, default: 0 }
    },
    // Recall@K - Tỷ lệ items relevant được tìm thấy trong K items
    recallAtK: {
      k5: { type: Number, default: 0 },
      k10: { type: Number, default: 0 },
      k20: { type: Number, default: 0 }
    },
    // F1@K
    f1AtK: {
      k5: { type: Number, default: 0 },
      k10: { type: Number, default: 0 },
      k20: { type: Number, default: 0 }
    },
    // Mean Average Precision
    map: { type: Number, default: 0 },
    // Normalized Discounted Cumulative Gain
    ndcg: {
      k5: { type: Number, default: 0 },
      k10: { type: Number, default: 0 },
      k20: { type: Number, default: 0 }
    },
    // Mean Reciprocal Rank
    mrr: { type: Number, default: 0 },
    // Hit Rate
    hitRate: {
      k5: { type: Number, default: 0 },
      k10: { type: Number, default: 0 },
      k20: { type: Number, default: 0 }
    },
    // Coverage - % products có thể được recommend
    coverage: { type: Number, default: 0 },
    // Diversity
    diversity: { type: Number, default: 0 },
    // Novelty
    novelty: { type: Number, default: 0 }
  },

  // === SEARCH METRICS ===
  searchMetrics: {
    // Precision
    precision: { type: Number, default: 0 },
    // Recall
    recall: { type: Number, default: 0 },
    // F1 Score
    f1: { type: Number, default: 0 },
    // Mean Average Precision
    map: { type: Number, default: 0 },
    // NDCG
    ndcg: { type: Number, default: 0 },
    // Mean Reciprocal Rank
    mrr: { type: Number, default: 0 },
    // Query latency (ms)
    avgQueryLatency: { type: Number, default: 0 },
    p95QueryLatency: { type: Number, default: 0 },
    // Click-through rate
    ctr: { type: Number, default: 0 }
  },

  // === CLASSIFICATION METRICS (Sentiment, Spam) ===
  classificationMetrics: {
    // Per-class metrics
    classes: [{
      className: String,
      precision: Number,
      recall: Number,
      f1: Number,
      support: Number // số samples trong class
    }],
    // Overall metrics
    accuracy: { type: Number, default: 0 },
    macroPrecision: { type: Number, default: 0 },
    macroRecall: { type: Number, default: 0 },
    macroF1: { type: Number, default: 0 },
    weightedPrecision: { type: Number, default: 0 },
    weightedRecall: { type: Number, default: 0 },
    weightedF1: { type: Number, default: 0 },
    // Confusion matrix
    confusionMatrix: [[Number]],
    confusionMatrixLabels: [String],
    // ROC AUC
    rocAuc: { type: Number, default: 0 },
    // Log Loss
    logLoss: { type: Number, default: 0 }
  },

  // === REGRESSION METRICS (Forecasting) ===
  regressionMetrics: {
    // Mean Absolute Error
    mae: { type: Number, default: 0 },
    // Mean Squared Error
    mse: { type: Number, default: 0 },
    // Root Mean Squared Error
    rmse: { type: Number, default: 0 },
    // Mean Absolute Percentage Error
    mape: { type: Number, default: 0 },
    // R-squared
    r2: { type: Number, default: 0 },
    // Adjusted R-squared
    adjustedR2: { type: Number, default: 0 },
    // Symmetric Mean Absolute Percentage Error
    smape: { type: Number, default: 0 }
  },

  // === CHATBOT METRICS ===
  chatbotMetrics: {
    // Intent classification
    intentAccuracy: { type: Number, default: 0 },
    intentF1: { type: Number, default: 0 },
    // Entity extraction
    entityPrecision: { type: Number, default: 0 },
    entityRecall: { type: Number, default: 0 },
    entityF1: { type: Number, default: 0 },
    // Response quality
    responseRelevance: { type: Number, default: 0 },
    responseCoherence: { type: Number, default: 0 },
    // User satisfaction
    avgSatisfactionRating: { type: Number, default: 0 },
    resolutionRate: { type: Number, default: 0 },
    escalationRate: { type: Number, default: 0 },
    // Performance
    avgResponseTime: { type: Number, default: 0 },
    p95ResponseTime: { type: Number, default: 0 }
  },

  // === CROSS-VALIDATION RESULTS ===
  crossValidation: {
    folds: { type: Number, default: 5 },
    scores: [Number],
    meanScore: { type: Number, default: 0 },
    stdScore: { type: Number, default: 0 }
  },

  // === A/B TEST RESULTS ===
  abTestResults: {
    testName: String,
    controlGroup: {
      sampleSize: Number,
      conversionRate: Number,
      avgRevenue: Number
    },
    treatmentGroup: {
      sampleSize: Number,
      conversionRate: Number,
      avgRevenue: Number
    },
    uplift: Number,
    pValue: Number,
    isSignificant: { type: Boolean, default: false },
    confidenceLevel: { type: Number, default: 0.95 }
  },

  // === COMPARISON WITH BASELINES ===
  baselineComparison: [{
    baselineName: String,
    baselineMetrics: mongoose.Schema.Types.Mixed,
    improvement: Number, // % improvement over baseline
    metric: String // Which metric is used for comparison
  }],

  // === MODEL HYPERPARAMETERS ===
  hyperparameters: mongoose.Schema.Types.Mixed,

  // === TRAINING INFO ===
  training: {
    startedAt: Date,
    completedAt: Date,
    duration: Number, // seconds
    epochs: Number,
    batchSize: Number,
    learningRate: Number,
    optimizer: String,
    lossFunction: String,
    earlyStoppingEpoch: Number,
    finalTrainingLoss: Number,
    finalValidationLoss: Number
  },

  // === NOTES & OBSERVATIONS ===
  notes: String,
  observations: [String],
  improvements: [String],
  limitations: [String],

  // === METADATA ===
  evaluatedAt: {
    type: Date,
    default: Date.now
  },
  evaluatedBy: String,
  status: {
    type: String,
    enum: ['draft', 'completed', 'archived'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Indexes
modelEvaluationSchema.index({ modelName: 1, version: 1 });
modelEvaluationSchema.index({ evaluatedAt: -1 });
// Note: modelType index already defined in field definition

// Static method: So sánh các versions của model
modelEvaluationSchema.statics.compareVersions = async function(modelName) {
  return this.find({ modelName })
    .sort({ version: -1 })
    .select('version recommendationMetrics classificationMetrics regressionMetrics evaluatedAt')
    .limit(5);
};

// Static method: Lấy best model
modelEvaluationSchema.statics.getBestModel = async function(modelType, metric) {
  const sortField = metric || (
    modelType === 'recommendation' ? 'recommendationMetrics.f1AtK.k10' :
    modelType === 'classification' ? 'classificationMetrics.macroF1' :
    modelType === 'regression' ? 'regressionMetrics.r2' : 'evaluatedAt'
  );

  return this.findOne({ modelType })
    .sort({ [sortField]: -1 })
    .limit(1);
};

// Instance method: Generate report summary
modelEvaluationSchema.methods.generateReportSummary = function() {
  const summary = {
    modelName: this.modelName,
    version: this.version,
    modelType: this.modelType,
    dataset: {
      total: this.dataset.totalSamples,
      trainTestSplit: this.dataset.trainTestSplit
    },
    mainMetrics: {},
    observations: this.observations,
    improvements: this.improvements
  };

  switch (this.modelType) {
    case 'recommendation':
      summary.mainMetrics = {
        'Precision@10': this.recommendationMetrics.precisionAtK.k10,
        'Recall@10': this.recommendationMetrics.recallAtK.k10,
        'F1@10': this.recommendationMetrics.f1AtK.k10,
        'NDCG@10': this.recommendationMetrics.ndcg.k10,
        'MRR': this.recommendationMetrics.mrr,
        'Coverage': this.recommendationMetrics.coverage
      };
      break;
    case 'nlp':
      summary.mainMetrics = {
        'Accuracy': this.classificationMetrics.accuracy,
        'Macro F1': this.classificationMetrics.macroF1,
        'ROC AUC': this.classificationMetrics.rocAuc
      };
      break;
    case 'forecasting':
      summary.mainMetrics = {
        'MAE': this.regressionMetrics.mae,
        'RMSE': this.regressionMetrics.rmse,
        'MAPE': this.regressionMetrics.mape,
        'R²': this.regressionMetrics.r2
      };
      break;
  }

  return summary;
};

module.exports = mongoose.model('ModelEvaluation', modelEvaluationSchema);
