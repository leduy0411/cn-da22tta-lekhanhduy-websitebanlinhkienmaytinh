/**
 * useRecommendations - Custom React Hook for AI Recommendation System V2
 * 
 * Provides recommendation data with automatic fallback from V2 (Python AI Service)
 * to V1 (NodeJS RecommendationService) if the advanced service is unavailable.
 * 
 * Features:
 * - Product recommendations (content-based + CF + association rules)
 * - User personalized recommendations (SVD + NCF + hybrid)
 * - Cart-based recommendations (association rules)
 * - Trending/popular products
 * - Click tracking for A/B testing
 * - Automatic V2 → V1 fallback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { aiAPI } from '../services/api';

/**
 * Hook for product-based recommendations (similar products)
 * Used on ProductDetail page
 */
export const useProductRecommendations = (productId, limit = 8) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null); // 'v2' | 'v1' | 'fallback'
  const [logId, setLogId] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    if (!productId) return;
    
    setLoading(true);
    setError(null);

    try {
      // Try V2 first (Python AI Service)
      const response = await aiAPI.v2.getProductRecommendations(productId, limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource(data.source || 'v2');
        setLogId(data.logId || null);
        return;
      }
    } catch (v2Error) {
      console.warn('[Recommendations V2] Fallback to V1:', v2Error.message);
    }

    try {
      // Fallback to V1
      const response = await aiAPI.getProductRecommendations(productId, 'hybrid', limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource('v1');
        return;
      }
    } catch (v1Error) {
      console.warn('[Recommendations V1] Also failed:', v1Error.message);
      setError('Không thể tải gợi ý sản phẩm');
    }

    setLoading(false);
  }, [productId, limit]);

  useEffect(() => {
    fetchRecommendations().finally(() => setLoading(false));
  }, [fetchRecommendations]);

  // Track click on a recommended product
  const trackClick = useCallback(async (clickedProductId) => {
    if (!logId) return;
    try {
      await aiAPI.v2.trackClick(logId, clickedProductId);
    } catch (err) {
      // Silent fail - tracking is non-critical
    }
  }, [logId]);

  return { recommendations, loading, error, source, trackClick, refetch: fetchRecommendations };
};

/**
 * Hook for user personalized recommendations
 * Used on Home page for logged-in users
 */
export const useUserRecommendations = (userId, limit = 12) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [logId, setLogId] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await aiAPI.v2.getUserRecommendations(userId, limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource(data.source || 'v2');
        setLogId(data.logId || null);
        setLoading(false);
        return;
      }
    } catch (v2Error) {
      console.warn('[User Recommendations V2] Fallback:', v2Error.message);
    }

    try {
      const response = await aiAPI.getUserRecommendations(limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource('v1');
      }
    } catch (v1Error) {
      setError('Không thể tải gợi ý cá nhân');
    }

    setLoading(false);
  }, [userId, limit]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const trackClick = useCallback(async (clickedProductId) => {
    if (!logId) return;
    try {
      await aiAPI.v2.trackClick(logId, clickedProductId);
    } catch (err) { /* silent */ }
  }, [logId]);

  return { recommendations, loading, error, source, trackClick, refetch: fetchRecommendations };
};

/**
 * Hook for cart-based recommendations (cross-sell)
 * Used on Cart page
 */
export const useCartRecommendations = (cartItems, limit = 6) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(null);
  const prevCartRef = useRef(null);

  const fetchRecommendations = useCallback(async () => {
    if (!cartItems || cartItems.length === 0) {
      setRecommendations([]);
      return;
    }

    // Avoid re-fetching if cart hasn't changed
    const cartKey = cartItems.map(i => i.product?._id || i.productId || i._id).sort().join(',');
    if (prevCartRef.current === cartKey) return;
    prevCartRef.current = cartKey;

    setLoading(true);

    const itemsPayload = cartItems.map(item => ({
      productId: item.product?._id || item.productId || item._id,
      quantity: item.quantity || 1
    }));

    try {
      const response = await aiAPI.v2.getCartRecommendations(itemsPayload, limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource(data.source || 'v2');
        setLoading(false);
        return;
      }
    } catch (v2Error) {
      console.warn('[Cart Recommendations V2] Fallback:', v2Error.message);
    }

    try {
      const response = await aiAPI.getCartRecommendations(itemsPayload, limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource('v1');
      }
    } catch (v1Error) {
      console.warn('[Cart Recommendations V1] Also failed');
    }

    setLoading(false);
  }, [cartItems, limit]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return { recommendations, loading, source };
};

/**
 * Hook for trending/popular products
 * Used on Home page
 */
export const useTrendingProducts = (limit = 12, category = null) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);

  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);

      try {
        const response = await aiAPI.v2.getTrending(limit, category);
        const data = response.data;
        
        if (data.success && data.recommendations?.length > 0) {
          setProducts(data.recommendations);
          setSource(data.source || 'v2');
          setLoading(false);
          return;
        }
      } catch (v2Error) {
        console.warn('[Trending V2] Fallback:', v2Error.message);
      }

      try {
        const response = await aiAPI.getPopularProducts(limit, category);
        const data = response.data;
        
        if (data.success && data.recommendations?.length > 0) {
          setProducts(data.recommendations);
          setSource('v1');
        }
      } catch (v1Error) {
        console.warn('[Trending V1] Also failed');
      }

      setLoading(false);
    };

    fetchTrending();
  }, [limit, category]);

  return { products, loading, source };
};

/**
 * Hook for best-seller products based on actual purchase data
 * Used on Home page
 */
export const useBestSellerProducts = (limit = 12, days = 30) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);

  useEffect(() => {
    const fetchBestSellers = async () => {
      setLoading(true);
      try {
        const response = await aiAPI.v2.getBestSellers(limit, days);
        const data = response.data;
        if (data.success && data.recommendations?.length > 0) {
          setProducts(data.recommendations);
          setSource('order-aggregation');
        }
      } catch (err) {
        console.warn('[BestSellers] Error:', err.message);
      }
      setLoading(false);
    };

    fetchBestSellers();
  }, [limit, days]);

  return { products, loading, source };
};

/**
 * Hook for tracking user interactions (view, click, add_to_cart, purchase)
 * Used across all pages
 */
export const useInteractionTracker = () => {
  const trackInteraction = useCallback(async (eventType, productId, metadata = {}) => {
    try {
      await aiAPI.v2.trackInteraction({
        eventType,
        productId,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      // Silent fail - tracking should never break UX
    }
  }, []);

  const trackView = useCallback((productId) => 
    trackInteraction('view', productId), [trackInteraction]);
  
  const trackClick = useCallback((productId, source = '') => 
    trackInteraction('click', productId, { source }), [trackInteraction]);
  
  const trackAddToCart = useCallback((productId, quantity = 1) => 
    trackInteraction('add_to_cart', productId, { quantity }), [trackInteraction]);
  
  const trackPurchase = useCallback((productId, price, quantity = 1) => 
    trackInteraction('purchase', productId, { price, quantity }), [trackInteraction]);

  return { trackView, trackClick, trackAddToCart, trackPurchase, trackInteraction };
};

const recommendationHooks = {
  useProductRecommendations,
  useUserRecommendations,
  useCartRecommendations,
  useTrendingProducts,
  useBestSellerProducts,
  useInteractionTracker
};

export default recommendationHooks;
