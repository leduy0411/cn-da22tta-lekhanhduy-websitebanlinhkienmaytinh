/**
 * SalesForecast Model
 * Lưu trữ dữ liệu và kết quả dự đoán doanh thu
 * 
 * @module models/SalesForecast
 * @description Schema cho AI Sales Forecasting - Dự đoán doanh thu và xu hướng
 */
const mongoose = require('mongoose');

// Schema cho dữ liệu bán hàng theo thời gian (time series)
const salesDataPointSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  // Metrics
  revenue: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },
  itemsSold: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 },
  uniqueCustomers: { type: Number, default: 0 },
  newCustomers: { type: Number, default: 0 },
  returningCustomers: { type: Number, default: 0 },
  // Category breakdown
  categoryBreakdown: mongoose.Schema.Types.Mixed,
  // Product breakdown (top products)
  topProducts: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    revenue: Number
  }]
}, { _id: false });

// Schema chính cho Sales Forecast
const salesForecastSchema = new mongoose.Schema({
  // Loại forecast
  forecastType: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    index: true
  },
  
  // Phạm vi áp dụng
  scope: {
    type: String,
    required: true,
    enum: ['overall', 'category', 'product', 'brand'],
    default: 'overall'
  },
  
  // ID của entity nếu scope không phải overall
  scopeId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'scopeModel'
  },
  scopeModel: {
    type: String,
    enum: ['Product', 'Category', null]
  },
  scopeName: String,

  // === HISTORICAL DATA ===
  historicalData: [salesDataPointSchema],
  
  // Thống kê từ historical data
  historicalStats: {
    startDate: Date,
    endDate: Date,
    totalRevenue: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    avgDailyRevenue: { type: Number, default: 0 },
    avgDailyOrders: { type: Number, default: 0 },
    maxRevenue: { type: Number, default: 0 },
    minRevenue: { type: Number, default: 0 },
    stdDeviation: { type: Number, default: 0 },
    trend: {
      type: String,
      enum: ['increasing', 'decreasing', 'stable', 'volatile'],
      default: 'stable'
    },
    seasonality: {
      hasSeasonality: { type: Boolean, default: false },
      pattern: String, // 'weekly', 'monthly', 'yearly'
      peakPeriods: [String]
    }
  },

  // === FORECAST RESULTS ===
  forecasts: [{
    date: Date,
    predictedRevenue: Number,
    predictedOrders: Number,
    confidenceInterval: {
      lower: Number,
      upper: Number
    },
    confidence: Number // 0-1
  }],

  // Forecast summary
  forecastSummary: {
    forecastStartDate: Date,
    forecastEndDate: Date,
    totalPredictedRevenue: { type: Number, default: 0 },
    totalPredictedOrders: { type: Number, default: 0 },
    avgPredictedDailyRevenue: { type: Number, default: 0 },
    growthRate: { type: Number, default: 0 }, // % so với historical
    predictedTrend: {
      type: String,
      enum: ['increasing', 'decreasing', 'stable'],
      default: 'stable'
    }
  },

  // === MODEL INFO ===
  model: {
    algorithm: {
      type: String,
      required: true,
      enum: [
        'moving-average',      // Simple Moving Average
        'exponential-smoothing', // Exponential Smoothing
        'linear-regression',   // Linear Regression
        'arima',              // ARIMA
        'sarima',             // Seasonal ARIMA
        'prophet',            // Facebook Prophet
        'lstm',               // LSTM Neural Network
        'ensemble'            // Ensemble of models
      ],
      default: 'moving-average'
    },
    parameters: mongoose.Schema.Types.Mixed, // Model-specific parameters
    version: { type: String, default: '1.0' },
    trainedAt: Date,
    trainingDataSize: Number
  },

  // === MODEL EVALUATION ===
  evaluation: {
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
    // Cross-validation scores
    cvScores: [Number],
    // Backtest results
    backtestResults: [{
      period: String,
      actual: Number,
      predicted: Number,
      error: Number,
      percentageError: Number
    }]
  },

  // === ANOMALY DETECTION ===
  anomalies: [{
    date: Date,
    type: {
      type: String,
      enum: ['spike', 'drop', 'outlier']
    },
    actualValue: Number,
    expectedValue: Number,
    deviation: Number, // % deviation
    possibleCauses: [String],
    acknowledged: { type: Boolean, default: false }
  }],

  // === INSIGHTS & RECOMMENDATIONS ===
  insights: [{
    type: {
      type: String,
      enum: ['trend', 'seasonality', 'anomaly', 'opportunity', 'risk']
    },
    title: String,
    description: String,
    confidence: Number,
    actionable: Boolean,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    }
  }],

  // === PROCESSING STATUS ===
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  errorMessage: String,
  processedAt: Date,
  processingTime: Number, // milliseconds

  // Auto-update settings
  autoUpdate: {
    enabled: { type: Boolean, default: true },
    frequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      default: 'daily'
    },
    lastUpdated: Date,
    nextUpdate: Date
  }
}, {
  timestamps: true
});

// Indexes
salesForecastSchema.index({ forecastType: 1, scope: 1 });
salesForecastSchema.index({ 'historicalStats.endDate': -1 });
salesForecastSchema.index({ 'forecastSummary.forecastStartDate': 1 });

// Static method: Aggregate sales data
salesForecastSchema.statics.aggregateSalesData = async function(options = {}) {
  const {
    startDate,
    endDate = new Date(),
    groupBy = 'day', // 'day', 'week', 'month'
    scope = 'overall',
    scopeId = null
  } = options;

  const Order = mongoose.model('Order');
  
  const matchStage = {
    status: { $in: ['delivered', 'shipped', 'processing'] },
    createdAt: { $gte: startDate, $lte: endDate }
  };

  let dateFormat;
  switch (groupBy) {
    case 'week':
      dateFormat = { $dateToString: { format: '%Y-W%V', date: '$createdAt' } };
      break;
    case 'month':
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      break;
    default:
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: dateFormat,
        revenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
        itemsSold: { $sum: { $size: '$items' } },
        uniqueCustomers: { $addToSet: '$user' }
      }
    },
    {
      $addFields: {
        avgOrderValue: { $divide: ['$revenue', '$orderCount'] },
        uniqueCustomerCount: { $size: '$uniqueCustomers' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ];

  return Order.aggregate(pipeline);
};

// Static method: Calculate trend
salesForecastSchema.statics.calculateTrend = function(data) {
  if (data.length < 2) return 'stable';
  
  const values = data.map(d => d.revenue || d.value);
  const n = values.length;
  
  // Linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgY = sumY / n;
  const percentageChange = (slope * n / avgY) * 100;
  
  // Calculate volatility
  const mean = avgY;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // Coefficient of variation
  
  if (cv > 0.5) return 'volatile';
  if (percentageChange > 5) return 'increasing';
  if (percentageChange < -5) return 'decreasing';
  return 'stable';
};

module.exports = mongoose.model('SalesForecast', salesForecastSchema);
