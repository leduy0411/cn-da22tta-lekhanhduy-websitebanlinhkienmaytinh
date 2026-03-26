const express = require('express');

const router = express.Router();

const { auth, optionalAuth } = require('../middleware/auth');
const { RecommendationService } = require('../services/ai');

router.get('/product/:productId', optionalAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10, type = 'hybrid' } = req.query;
    const userId = req.user?._id;

    let recommendations;

    switch (type) {
      case 'rule-based':
        recommendations = await RecommendationService.getRuleBasedRecommendations(productId, { limit: parseInt(limit, 10) });
        break;
      case 'item-based':
        recommendations = await RecommendationService.getItemBasedCF(productId, { limit: parseInt(limit, 10) });
        break;
      case 'content-based':
        recommendations = await RecommendationService.getContentBasedRecommendations(productId, { limit: parseInt(limit, 10) });
        break;
      case 'cross-sell':
        recommendations = await RecommendationService.getCrossSellRecommendations(productId, { limit: parseInt(limit, 10) });
        break;
      case 'hybrid':
      default:
        recommendations = await RecommendationService.getHybridRecommendations(userId, productId, { limit: parseInt(limit, 10) });
        break;
    }

    return res.json({
      success: true,
      type,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/user', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    const recommendations = await RecommendationService.getPersonalizedRecommendations(userId, {
      limit: parseInt(limit, 10)
    });

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('User recommendation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/popular', async (req, res) => {
  try {
    const { limit = 10, category = null, timeRange = 30 } = req.query;

    const recommendations = await RecommendationService.getPopularRecommendations({
      limit: parseInt(limit, 10),
      category,
      timeRange: parseInt(timeRange, 10)
    });

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Popular products error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/cart', async (req, res) => {
  try {
    const { cartItems } = req.body;
    const { limit = 5 } = req.query;

    const recommendations = await RecommendationService.getCartRecommendations(cartItems, {
      limit: parseInt(limit, 10)
    });

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Cart recommendation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
