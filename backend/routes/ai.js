const express = require('express');

const router = express.Router();

const { SemanticSearchService } = require('../services/ai');

router.get('/search', async (req, res) => {
  try {
    const {
      q,
      limit = 20,
      type = 'hybrid',
      category = null,
      brand = null,
      minPrice = null,
      maxPrice = null
    } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
    }

    let results;
    const options = {
      limit: parseInt(limit, 10),
      category,
      brand,
      priceRange: (minPrice || maxPrice)
        ? {
            min: minPrice ? parseFloat(minPrice) : 0,
            max: maxPrice ? parseFloat(maxPrice) : Number.MAX_VALUE
          }
        : null
    };

    switch (type) {
      case 'keyword':
        results = await SemanticSearchService.keywordSearch(q, options);
        break;
      case 'tfidf':
        results = await SemanticSearchService.searchTFIDF(q, options);
        break;
      case 'embedding':
        results = await SemanticSearchService.searchWithEmbeddings(q, options);
        break;
      case 'hybrid':
      default:
        results = await SemanticSearchService.hybridSearch(q, options);
        break;
    }

    return res.json({
      success: true,
      query: q,
      type,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search/autocomplete', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: { products: [], categories: [], brands: [] } });
    }

    const suggestions = await SemanticSearchService.getAutocompleteSuggestions(q, {
      limit: parseInt(limit, 10)
    });

    return res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Autocomplete error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search/related', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q) {
      return res.json({ success: true, relatedSearches: [] });
    }

    const relatedSearches = await SemanticSearchService.getRelatedSearches(q, {
      limit: parseInt(limit, 10)
    });

    return res.json({
      success: true,
      relatedSearches
    });
  } catch (error) {
    console.error('Related search error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
