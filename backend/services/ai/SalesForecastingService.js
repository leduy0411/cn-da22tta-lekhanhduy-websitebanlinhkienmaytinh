/**
 * Sales Forecasting Service
 * Dự đoán doanh thu và xu hướng bán hàng
 * 
 * @module services/ai/SalesForecastingService
 * @description AI Service cho Sales Forecasting với nhiều algorithms
 */

const mongoose = require('mongoose');
const Order = require('../../models/Order');
const SalesForecast = require('../../models/SalesForecast');

class SalesForecastingService {
  constructor() {
    this.forecastCache = new Map();
    this.cacheTTL = 60 * 60 * 1000; // 1 hour
  }

  // ==================== DATA AGGREGATION ====================

  /**
   * Aggregate historical sales data
   */
  async aggregateSalesData(options = {}) {
    const {
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      endDate = new Date(),
      groupBy = 'day', // 'day', 'week', 'month'
      scope = 'overall',
      scopeId = null
    } = options;

    let dateFormat;
    let dateGroupId;
    
    switch (groupBy) {
      case 'week':
        dateFormat = '%Y-W%V';
        dateGroupId = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'month':
        dateFormat = '%Y-%m';
        dateGroupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default: // day
        dateFormat = '%Y-%m-%d';
        dateGroupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const matchStage = {
      status: { $in: ['delivered', 'shipped', 'processing', 'pending'] },
      createdAt: { $gte: startDate, $lte: endDate }
    };

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: dateGroupId,
          dateStr: { $first: { $dateToString: { format: dateFormat, date: '$createdAt' } } },
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          itemsSold: { $sum: { $size: '$items' } },
          uniqueCustomers: { $addToSet: '$user' },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      {
        $addFields: {
          uniqueCustomerCount: { $size: '$uniqueCustomers' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
      {
        $project: {
          _id: 0,
          date: '$dateStr',
          revenue: 1,
          orderCount: 1,
          itemsSold: 1,
          uniqueCustomers: '$uniqueCustomerCount',
          avgOrderValue: 1
        }
      }
    ];

    const data = await Order.aggregate(pipeline);
    return data;
  }

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(startDate, endDate) {
    const pipeline = [
      {
        $match: {
          status: { $in: ['delivered', 'shipped', 'processing'] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$productInfo.category',
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          quantity: { $sum: '$items.quantity' },
          orderCount: { $addToSet: '$_id' }
        }
      },
      {
        $addFields: {
          orderCount: { $size: '$orderCount' }
        }
      },
      { $sort: { revenue: -1 } }
    ];

    return Order.aggregate(pipeline);
  }

  // ==================== FORECASTING ALGORITHMS ====================

  /**
   * Simple Moving Average
   */
  movingAverage(data, window = 7) {
    const result = [];
    for (let i = window - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < window; j++) {
        sum += data[i - j];
      }
      result.push(sum / window);
    }
    return result;
  }

  /**
   * Exponential Moving Average
   */
  exponentialMovingAverage(data, alpha = 0.3) {
    if (data.length === 0) return [];
    
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
  }

  /**
   * Simple Exponential Smoothing Forecast
   */
  exponentialSmoothingForecast(data, alpha = 0.3, periods = 7) {
    if (data.length === 0) return [];
    
    // Calculate EMA on historical data
    const ema = this.exponentialMovingAverage(data, alpha);
    const lastValue = ema[ema.length - 1];
    
    // Forecast: Use last EMA value
    const forecasts = [];
    for (let i = 0; i < periods; i++) {
      forecasts.push({
        value: lastValue,
        confidence: Math.max(0.3, 1 - (i * 0.1)) // Decrease confidence over time
      });
    }
    
    return forecasts;
  }

  /**
   * Linear Regression
   */
  linearRegression(xValues, yValues) {
    const n = xValues.length;
    if (n !== yValues.length || n === 0) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += xValues[i];
      sumY += yValues[i];
      sumXY += xValues[i] * yValues[i];
      sumX2 += xValues[i] * xValues[i];
      sumY2 += yValues[i] * yValues[i];
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    
    for (let i = 0; i < n; i++) {
      const predicted = slope * xValues[i] + intercept;
      ssTotal += (yValues[i] - yMean) ** 2;
      ssResidual += (yValues[i] - predicted) ** 2;
    }

    const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    return { slope, intercept, r2: Math.max(0, r2) };
  }

  /**
   * Linear Regression Forecast
   */
  linearRegressionForecast(data, periods = 7) {
    const xValues = data.map((_, i) => i);
    const yValues = data;

    const { slope, intercept, r2 } = this.linearRegression(xValues, yValues);

    const forecasts = [];
    const n = data.length;

    for (let i = 0; i < periods; i++) {
      const x = n + i;
      const predicted = slope * x + intercept;
      
      // Calculate prediction interval
      const stdError = this.calculateStdError(data, slope, intercept);
      const confidence = Math.max(0.3, r2 - (i * 0.05));

      forecasts.push({
        value: Math.max(0, predicted),
        lower: Math.max(0, predicted - 1.96 * stdError),
        upper: predicted + 1.96 * stdError,
        confidence
      });
    }

    return { forecasts, model: { slope, intercept, r2 } };
  }

  /**
   * Calculate Standard Error
   */
  calculateStdError(data, slope, intercept) {
    const n = data.length;
    let sumSquaredError = 0;

    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      sumSquaredError += (data[i] - predicted) ** 2;
    }

    return Math.sqrt(sumSquaredError / (n - 2));
  }

  /**
   * Holt's Linear Trend Method (Double Exponential Smoothing)
   */
  holtsLinearTrend(data, alpha = 0.3, beta = 0.1, periods = 7) {
    if (data.length < 2) return [];

    // Initialize
    let level = data[0];
    let trend = data[1] - data[0];
    
    // Smooth historical data
    for (let i = 1; i < data.length; i++) {
      const prevLevel = level;
      level = alpha * data[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    // Forecast
    const forecasts = [];
    for (let i = 1; i <= periods; i++) {
      const value = level + i * trend;
      const confidence = Math.max(0.3, 0.9 - (i * 0.08));
      
      forecasts.push({
        value: Math.max(0, value),
        confidence
      });
    }

    return forecasts;
  }

  /**
   * Seasonal Decomposition (Simple)
   */
  seasonalDecomposition(data, period = 7) {
    if (data.length < period * 2) {
      return { trend: data, seasonal: new Array(data.length).fill(0), residual: new Array(data.length).fill(0) };
    }

    // Calculate trend using moving average
    const trend = [];
    for (let i = 0; i < data.length; i++) {
      if (i < Math.floor(period / 2) || i >= data.length - Math.floor(period / 2)) {
        trend.push(data[i]);
      } else {
        let sum = 0;
        for (let j = -Math.floor(period / 2); j <= Math.floor(period / 2); j++) {
          sum += data[i + j];
        }
        trend.push(sum / period);
      }
    }

    // Calculate seasonal component
    const detrended = data.map((d, i) => d - trend[i]);
    const seasonalAvg = new Array(period).fill(0);
    const counts = new Array(period).fill(0);

    detrended.forEach((val, i) => {
      const idx = i % period;
      seasonalAvg[idx] += val;
      counts[idx]++;
    });

    seasonalAvg.forEach((_, i) => {
      seasonalAvg[i] = counts[i] > 0 ? seasonalAvg[i] / counts[i] : 0;
    });

    const seasonal = data.map((_, i) => seasonalAvg[i % period]);

    // Calculate residual
    const residual = data.map((d, i) => d - trend[i] - seasonal[i]);

    return { trend, seasonal, residual, seasonalFactors: seasonalAvg };
  }

  // ==================== MAIN FORECASTING METHOD ====================

  /**
   * Generate comprehensive forecast
   */
  async generateForecast(options = {}) {
    const {
      forecastPeriods = 30,
      forecastType = 'daily',
      scope = 'overall',
      scopeId = null,
      algorithm = 'ensemble'
    } = options;

    // Get historical data
    const historicalData = await this.aggregateSalesData({
      startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months
      groupBy: forecastType === 'monthly' ? 'month' : 'day',
      scope,
      scopeId
    });

    if (historicalData.length < 7) {
      throw new Error('Insufficient historical data for forecasting');
    }

    const revenueData = historicalData.map(d => d.revenue);
    const orderData = historicalData.map(d => d.orderCount);

    // Generate forecasts using multiple methods
    let revenueForecast, orderForecast, model;

    switch (algorithm) {
      case 'linear-regression':
        const lrResult = this.linearRegressionForecast(revenueData, forecastPeriods);
        revenueForecast = lrResult.forecasts;
        model = { algorithm: 'linear-regression', parameters: lrResult.model };
        break;

      case 'exponential-smoothing':
        revenueForecast = this.exponentialSmoothingForecast(revenueData, 0.3, forecastPeriods);
        model = { algorithm: 'exponential-smoothing', parameters: { alpha: 0.3 } };
        break;

      case 'holt':
        revenueForecast = this.holtsLinearTrend(revenueData, 0.3, 0.1, forecastPeriods);
        model = { algorithm: 'moving-average', parameters: { alpha: 0.3, beta: 0.1 } };
        break;

      case 'ensemble':
      default:
        // Combine multiple methods
        const lr = this.linearRegressionForecast(revenueData, forecastPeriods);
        const es = this.exponentialSmoothingForecast(revenueData, 0.3, forecastPeriods);
        const holt = this.holtsLinearTrend(revenueData, 0.3, 0.1, forecastPeriods);

        revenueForecast = [];
        for (let i = 0; i < forecastPeriods; i++) {
          const lrVal = lr.forecasts[i]?.value || 0;
          const esVal = es[i]?.value || 0;
          const holtVal = holt[i]?.value || 0;

          // Weighted average
          const value = (lrVal * 0.3 + esVal * 0.3 + holtVal * 0.4);
          const confidence = Math.min(
            lr.forecasts[i]?.confidence || 0.5,
            es[i]?.confidence || 0.5,
            holt[i]?.confidence || 0.5
          );

          revenueForecast.push({ value, confidence });
        }
        model = { algorithm: 'ensemble', parameters: { methods: ['linear-regression', 'exponential-smoothing', 'holt'] } };
    }

    // Order forecast (simpler - ratio based)
    const avgOrderValue = revenueData.reduce((a, b) => a + b, 0) / orderData.reduce((a, b) => a + b, 0);
    orderForecast = revenueForecast.map(f => ({
      value: Math.round(f.value / avgOrderValue),
      confidence: f.confidence
    }));

    // Calculate historical stats
    const historicalStats = this.calculateHistoricalStats(historicalData);

    // Detect anomalies
    const anomalies = this.detectAnomalies(historicalData);

    // Generate insights
    const insights = this.generateInsights(historicalData, revenueForecast, historicalStats);

    // Build forecast dates
    const lastDate = new Date(historicalData[historicalData.length - 1].date);
    const forecasts = revenueForecast.map((f, i) => {
      const date = new Date(lastDate);
      if (forecastType === 'monthly') {
        date.setMonth(date.getMonth() + i + 1);
      } else {
        date.setDate(date.getDate() + i + 1);
      }

      return {
        date,
        predictedRevenue: Math.round(f.value),
        predictedOrders: orderForecast[i].value,
        confidenceInterval: {
          lower: Math.round(f.value * 0.8),
          upper: Math.round(f.value * 1.2)
        },
        confidence: f.confidence
      };
    });

    // Calculate forecast summary
    const totalPredictedRevenue = forecasts.reduce((sum, f) => sum + f.predictedRevenue, 0);
    const totalPredictedOrders = forecasts.reduce((sum, f) => sum + f.predictedOrders, 0);
    const avgPredictedDailyRevenue = totalPredictedRevenue / forecastPeriods;
    const growthRate = ((avgPredictedDailyRevenue - historicalStats.avgDailyRevenue) / historicalStats.avgDailyRevenue) * 100;

    // Save to database
    const forecast = await SalesForecast.findOneAndUpdate(
      { forecastType, scope, scopeId: scopeId || null },
      {
        forecastType,
        scope,
        scopeId,
        historicalData: historicalData.map(d => ({
          date: new Date(d.date),
          revenue: d.revenue,
          orderCount: d.orderCount,
          itemsSold: d.itemsSold,
          avgOrderValue: d.avgOrderValue,
          uniqueCustomers: d.uniqueCustomers
        })),
        historicalStats,
        forecasts,
        forecastSummary: {
          forecastStartDate: forecasts[0].date,
          forecastEndDate: forecasts[forecasts.length - 1].date,
          totalPredictedRevenue,
          totalPredictedOrders,
          avgPredictedDailyRevenue,
          growthRate,
          predictedTrend: growthRate > 5 ? 'increasing' : (growthRate < -5 ? 'decreasing' : 'stable')
        },
        model: {
          algorithm: model.algorithm,
          parameters: model.parameters,
          version: '1.0',
          trainedAt: new Date(),
          trainingDataSize: historicalData.length
        },
        anomalies,
        insights,
        status: 'completed',
        processedAt: new Date()
      },
      { upsert: true, new: true }
    );

    return forecast;
  }

  /**
   * Calculate historical statistics
   */
  calculateHistoricalStats(data) {
    const revenues = data.map(d => d.revenue);
    const totalRevenue = revenues.reduce((a, b) => a + b, 0);
    const totalOrders = data.reduce((sum, d) => sum + d.orderCount, 0);

    // Calculate standard deviation
    const mean = totalRevenue / revenues.length;
    const variance = revenues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / revenues.length;
    const stdDeviation = Math.sqrt(variance);

    // Detect trend
    const { slope, r2 } = this.linearRegression(
      revenues.map((_, i) => i),
      revenues
    );

    let trend;
    if (r2 > 0.5) {
      trend = slope > 0 ? 'increasing' : 'decreasing';
    } else {
      const cv = stdDeviation / mean;
      trend = cv > 0.5 ? 'volatile' : 'stable';
    }

    // Detect seasonality (simple check)
    const seasonality = this.detectSeasonality(revenues);

    return {
      startDate: new Date(data[0].date),
      endDate: new Date(data[data.length - 1].date),
      totalRevenue,
      totalOrders,
      avgDailyRevenue: totalRevenue / data.length,
      avgDailyOrders: totalOrders / data.length,
      maxRevenue: Math.max(...revenues),
      minRevenue: Math.min(...revenues),
      stdDeviation,
      trend,
      seasonality
    };
  }

  /**
   * Detect seasonality
   */
  detectSeasonality(data, period = 7) {
    if (data.length < period * 2) {
      return { hasSeasonality: false };
    }

    const { seasonalFactors } = this.seasonalDecomposition(data, period);
    const avgFactor = seasonalFactors.reduce((a, b) => a + Math.abs(b), 0) / period;
    const hasSeasonality = avgFactor > data.reduce((a, b) => a + b, 0) / data.length * 0.1;

    return {
      hasSeasonality,
      pattern: period === 7 ? 'weekly' : 'monthly',
      peakPeriods: seasonalFactors
        .map((f, i) => ({ index: i, factor: f }))
        .filter(f => f.factor > avgFactor)
        .map(f => period === 7 ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][f.index] : `Day ${f.index + 1}`)
    };
  }

  /**
   * Detect anomalies
   */
  detectAnomalies(data) {
    const revenues = data.map(d => d.revenue);
    const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const std = Math.sqrt(revenues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / revenues.length);

    const anomalies = [];
    const threshold = 2; // 2 standard deviations

    data.forEach((d, i) => {
      const zScore = Math.abs((d.revenue - mean) / std);
      if (zScore > threshold) {
        anomalies.push({
          date: new Date(d.date),
          type: d.revenue > mean ? 'spike' : 'drop',
          actualValue: d.revenue,
          expectedValue: mean,
          deviation: ((d.revenue - mean) / mean) * 100,
          possibleCauses: d.revenue > mean ? ['Promotion', 'Holiday', 'New product'] : ['Technical issue', 'Competition', 'Seasonal low']
        });
      }
    });

    return anomalies;
  }

  /**
   * Generate insights
   */
  generateInsights(historicalData, forecasts, stats) {
    const insights = [];

    // Trend insight
    if (stats.trend === 'increasing') {
      insights.push({
        type: 'trend',
        title: 'Doanh thu đang tăng trưởng',
        description: `Doanh thu có xu hướng tăng trong thời gian qua với mức tăng trung bình hàng ngày`,
        confidence: 0.8,
        actionable: false,
        priority: 'medium'
      });
    } else if (stats.trend === 'decreasing') {
      insights.push({
        type: 'risk',
        title: 'Doanh thu đang giảm',
        description: 'Cần xem xét các chiến lược marketing để cải thiện doanh số',
        confidence: 0.8,
        actionable: true,
        priority: 'high'
      });
    }

    // Seasonality insight
    if (stats.seasonality?.hasSeasonality) {
      insights.push({
        type: 'seasonality',
        title: 'Phát hiện pattern theo tuần',
        description: `Doanh thu cao nhất vào các ngày: ${stats.seasonality.peakPeriods?.join(', ')}`,
        confidence: 0.7,
        actionable: true,
        priority: 'medium'
      });
    }

    // Forecast opportunity
    const avgForecast = forecasts.reduce((sum, f) => sum + f.value, 0) / forecasts.length;
    if (avgForecast > stats.avgDailyRevenue * 1.1) {
      insights.push({
        type: 'opportunity',
        title: 'Dự báo tăng trưởng tích cực',
        description: `Doanh thu dự kiến tăng ${((avgForecast / stats.avgDailyRevenue - 1) * 100).toFixed(1)}% trong thời gian tới`,
        confidence: 0.6,
        actionable: false,
        priority: 'low'
      });
    }

    return insights;
  }

  /**
   * Evaluate model performance
   */
  async evaluateModel(forecastId) {
    const forecast = await SalesForecast.findById(forecastId);
    if (!forecast || !forecast.forecasts || forecast.forecasts.length === 0) {
      throw new Error('Forecast not found or incomplete');
    }

    // Get actual data for forecast period
    const actualData = await this.aggregateSalesData({
      startDate: forecast.forecastSummary.forecastStartDate,
      endDate: forecast.forecastSummary.forecastEndDate
    });

    if (actualData.length === 0) {
      return { message: 'No actual data available yet for evaluation' };
    }

    // Calculate metrics
    let sumAbsError = 0, sumSquaredError = 0, sumAbsPercentError = 0;
    const backtestResults = [];

    const minLength = Math.min(actualData.length, forecast.forecasts.length);

    for (let i = 0; i < minLength; i++) {
      const actual = actualData[i].revenue;
      const predicted = forecast.forecasts[i].predictedRevenue;
      const error = actual - predicted;
      const percentError = actual > 0 ? Math.abs(error) / actual * 100 : 0;

      sumAbsError += Math.abs(error);
      sumSquaredError += error * error;
      sumAbsPercentError += percentError;

      backtestResults.push({
        period: actualData[i].date,
        actual,
        predicted,
        error,
        percentageError: percentError
      });
    }

    const n = minLength;
    const evaluation = {
      mae: sumAbsError / n,
      mse: sumSquaredError / n,
      rmse: Math.sqrt(sumSquaredError / n),
      mape: sumAbsPercentError / n,
      backtestResults
    };

    // Update forecast with evaluation
    forecast.evaluation = evaluation;
    await forecast.save();

    return evaluation;
  }
}

module.exports = new SalesForecastingService();
