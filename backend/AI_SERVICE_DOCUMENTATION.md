# AI Service Layer Documentation
## TechStore E-commerce - Đồ án Tốt nghiệp

---

## 1. Tổng quan Kiến trúc

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐│
│  │ProductPage│ │SearchBar │ │ CartPage │ │     ChatWidget       ││
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └──────────┬───────────┘│
└────────┼────────────┼────────────┼─────────────────┼────────────┘
         │            │            │                 │
         ▼            ▼            ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Express.js)                     │
│                        /api/ai/*                                 │
└─────────────────────────────────────────────────────────────────┘
         │            │            │                 │
         ▼            ▼            ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI SERVICE LAYER                            │
│  ┌────────────────┐ ┌────────────────┐ ┌─────────────────────┐  │
│  │Recommendation  │ │ SemanticSearch │ │   ReviewAnalysis    │  │
│  │   Service      │ │    Service     │ │      Service        │  │
│  │ ─Rule-based    │ │ ─TF-IDF        │ │ ─Sentiment Analysis │  │
│  │ ─User-based CF │ │ ─Cosine Sim    │ │ ─Spam Detection     │  │
│  │ ─Item-based CF │ │ ─Hybrid Search │ │ ─Aspect Sentiment   │  │
│  │ ─Content-based │ │ ─Autocomplete  │ │ ─Quality Metrics    │  │
│  │ ─Hybrid        │ │                │ │                     │  │
│  └───────┬────────┘ └───────┬────────┘ └──────────┬──────────┘  │
│          │                  │                     │              │
│  ┌───────┴────────┐ ┌───────┴────────┐ ┌─────────┴──────────┐   │
│  │SalesForecasting│ │    Chatbot     │ │  ModelEvaluation   │   │
│  │    Service     │ │    Service     │ │      Service       │   │
│  │ ─Linear Reg.   │ │ ─Intent Class. │ │ ─Precision@K       │   │
│  │ ─Exp.Smoothing │ │ ─Entity Extract│ │ ─Recall@K          │   │
│  │ ─Holt's Linear │ │ ─DB Queries    │ │ ─F1@K, NDCG        │   │
│  │ ─Ensemble      │ │ ─Context Aware │ │ ─Cross Validation  │   │
│  └───────┬────────┘ └───────┬────────┘ └──────────┬──────────┘  │
└──────────┼──────────────────┼─────────────────────┼─────────────┘
           │                  │                     │
           ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER (MongoDB)                         │
│  ┌────────────┐ ┌────────────────┐ ┌───────────────────────────┐│
│  │UserInteract│ │ProductEmbedding│ │ReviewAnalysis│SalesForecast││
│  │    ion     │ │                │ │ChatbotConver.│ModelEvaluat.││
│  └────────────┘ └────────────────┘ └───────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Component | Technology | Lý do chọn |
|-----------|------------|------------|
| Backend | Node.js + Express | Tích hợp dễ dàng với hệ thống hiện có |
| Database | MongoDB | Document-based, flexible schema cho ML data |
| Text Processing | TF-IDF (custom) | Lightweight, không cần Python dependency |
| Vector Similarity | Cosine Similarity | Chuẩn cho text/embedding comparison |
| Time Series | Holt's Linear Trend | Đơn giản, hiệu quả cho short-term forecast |
| NLP | Rule-based + Lexicon | Hỗ trợ tiếng Việt, không cần training |

---

## 2. Chi tiết các AI Services

### 2.1 Recommendation Service

#### 2.1.1 Các mức độ Recommendation

| Level | Algorithm | Complexity | Accuracy | Use Case |
|-------|-----------|------------|----------|----------|
| 1 | Rule-based | O(n) | Low | Cold start, fallback |
| 2 | User-based CF | O(n²) | Medium | Personalized recs |
| 3 | Item-based CF | O(n²) | Medium-High | Similar products |
| 4 | Content-based | O(n×d) | Medium | New products |
| 5 | Hybrid | O(n²) | High | Production system |

#### 2.1.2 Các phương thức chính

```javascript
// Rule-based: Sản phẩm cùng category, brand
getRuleBasedRecommendations(productId, options)

// User-based CF: Cosine similarity giữa user interaction vectors
getUserBasedCF(userId, options)

// Item-based CF: Cosine similarity giữa item vectors
getItemBasedCF(productId, options)

// Content-based: So sánh TF-IDF vectors
getContentBasedRecommendations(productId, options)

// Hybrid: Kết hợp tất cả với weighted averaging
getHybridRecommendations(userId, productId, options)

// Cart-based: Cross-sell recommendations
getCartRecommendations(cartItems, options)
```

#### 2.1.3 Interaction Weights

| Type | Weight | Mô tả |
|------|--------|-------|
| view | 1 | Xem sản phẩm |
| quick_view | 1.5 | Quick view popup |
| add_to_wishlist | 2.5 | Thêm wishlist |
| cart_add | 3 | Thêm giỏ hàng |
| purchase | 5 | Mua hàng |

---

### 2.2 Semantic Search Service

#### 2.2.1 TF-IDF Implementation

```
TF(t,d) = (Số lần xuất hiện của term t trong document d) / (Tổng số terms trong d)
IDF(t) = log(N / df(t))
TF-IDF(t,d) = TF(t,d) × IDF(t)
```

#### 2.2.2 Cosine Similarity

```
similarity(A, B) = (A · B) / (||A|| × ||B||)
                 = Σ(Ai × Bi) / (√Σ(Ai²) × √Σ(Bi²))
```

#### 2.2.3 Hybrid Search

```javascript
hybridScore = α × keywordScore + (1-α) × tfidfScore
// α = 0.3 (default)
```

#### 2.2.4 Vietnamese Stopwords

Service bao gồm 50+ Vietnamese stopwords:
`của`, `và`, `là`, `có`, `được`, `trong`, `này`, `cho`, `với`, ...

---

### 2.3 Review Analysis Service

#### 2.3.1 Sentiment Analysis

**Vietnamese Lexicon:**
- **Positive words**: `tốt`, `đẹp`, `chất lượng`, `nhanh`, `tuyệt vời`, ...
- **Negative words**: `xấu`, `chậm`, `đắt`, `kém`, `hư`, `lỗi`, ...
- **Negation words**: `không`, `chưa`, `chẳng`, `chả`, `đừng`, ...
- **Intensifiers**: `rất`, `cực kỳ`, `quá`, `siêu`, `vô cùng`, ...

**Scoring Formula:**
```
rawScore = posWords × (1 + intensifierCount) - negWords × negationFactor
finalScore = normalize(rawScore, -1, 1)
sentiment = score > 0.2 ? 'positive' : (score < -0.2 ? 'negative' : 'neutral')
```

#### 2.3.2 Spam Detection

**Spam Indicators:**
| Factor | Weight | Mô tả |
|--------|--------|-------|
| excessiveCapitals | 0.3 | >30% chữ hoa |
| repetitiveChars | 0.2 | aaaa, !!!!!! |
| shortContent | 0.2 | <20 ký tự |
| urlPresent | 0.3 | Chứa links |
| excessivePunctuation | 0.2 | >10% dấu câu |
| ratingMismatch | 0.4 | Rating vs sentiment không khớp |

```
isSpam = totalWeight > 0.6
```

#### 2.3.3 Aspect-based Sentiment

Phân tích sentiment theo từng khía cạnh:
- **Chất lượng**: quality, material, build
- **Giá cả**: price, value, expensive
- **Giao hàng**: delivery, shipping, fast
- **Dịch vụ**: service, support, staff

---

### 2.4 Sales Forecasting Service

#### 2.4.1 Algorithms

| Algorithm | Formula | Use Case |
|-----------|---------|----------|
| Moving Average | $\hat{y}_{t+1} = \frac{1}{n}\sum_{i=0}^{n-1}y_{t-i}$ | Stable trends |
| Exponential Smoothing | $\hat{y}_{t+1} = \alpha y_t + (1-\alpha)\hat{y}_t$ | Recent data emphasis |
| Linear Regression | $y = \beta_0 + \beta_1 x$ | Linear trends |
| Holt's Linear | $l_t = \alpha y_t + (1-\alpha)(l_{t-1} + b_{t-1})$ | Trend + level |
| Ensemble | Weighted average of all | Production |

#### 2.4.2 Confidence Intervals

```
CI = forecast ± z × standardError
// 95% CI: z = 1.96
// 80% CI: z = 1.28
```

#### 2.4.3 Anomaly Detection

```
anomaly = |actual - forecast| > 2 × standardDeviation
```

---

### 2.5 Chatbot Service

#### 2.5.1 Intent Classification

| Intent | Pattern Examples | Response Type |
|--------|------------------|---------------|
| greeting | xin chào, hi, hello | Static text |
| product_search | tìm kiếm, tìm giúp | DB query |
| price_inquiry | giá bao nhiêu | DB query |
| product_compare | so sánh | DB query |
| order_status | đơn hàng, kiểm tra | DB query |
| return_policy | đổi trả, hoàn tiền | Static text |
| payment_methods | thanh toán | Static text |
| shipping_info | giao hàng, vận chuyển | Static text |

#### 2.5.2 Entity Extraction

```javascript
entities = {
  category: RegExp(/laptop|điện thoại|tai nghe|.../).match(text),
  brand: RegExp(/apple|samsung|sony|.../).match(text),
  priceRange: /dưới (\d+)/.match(text) || /(\d+) đến (\d+)/.match(text),
  orderId: /[A-Z0-9]{6,}/.match(text)
}
```

#### 2.5.3 Conversation State Machine

```
        ┌─────────┐
        │ started │
        └────┬────┘
             │ greeting
             ▼
       ┌──────────┐
       │ greeting │
       └────┬─────┘
            │ query
            ▼
       ┌────────────┐
       │ querying   │◄────┐
       └────┬───────┘     │
            │             │ follow-up
            ▼             │
       ┌────────────┐     │
       │ responding ├─────┘
       └────┬───────┘
            │ goodbye
            ▼
       ┌─────────┐
       │  ended  │
       └─────────┘
```

---

### 2.6 Model Evaluation Service

#### 2.6.1 Recommendation Metrics

| Metric | Formula | Mô tả |
|--------|---------|-------|
| Precision@K | $\frac{|\text{relevant} \cap \text{recommended}|}{K}$ | Tỷ lệ relevant trong top-K |
| Recall@K | $\frac{|\text{relevant} \cap \text{recommended}|}{|\text{relevant}|}$ | Coverage of relevant items |
| F1@K | $\frac{2 \times P \times R}{P + R}$ | Harmonic mean |
| NDCG@K | $\frac{DCG@K}{IDCG@K}$ | Ranking quality |
| MRR | $\frac{1}{|Q|}\sum_{i=1}^{|Q|}\frac{1}{\text{rank}_i}$ | Mean Reciprocal Rank |
| Hit Rate | $\frac{|\text{users with hit}|}{|\text{users}|}$ | % users with relevant rec |
| Coverage | $\frac{|\text{recommended items}|}{|\text{all items}|}$ | Catalog coverage |
| Diversity | Average pairwise similarity | Recommendation variety |

#### 2.6.2 Classification Metrics (Sentiment)

| Metric | Formula |
|--------|---------|
| Accuracy | $\frac{TP + TN}{TP + TN + FP + FN}$ |
| Precision | $\frac{TP}{TP + FP}$ |
| Recall | $\frac{TP}{TP + FN}$ |
| F1-Score | $\frac{2 \times P \times R}{P + R}$ |

#### 2.6.3 Regression Metrics (Forecasting)

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| MAE | $\frac{1}{n}\sum|y_i - \hat{y}_i|$ | Average absolute error |
| RMSE | $\sqrt{\frac{1}{n}\sum(y_i - \hat{y}_i)^2}$ | Root mean squared error |
| MAPE | $\frac{100}{n}\sum|\frac{y_i - \hat{y}_i}{y_i}|$ | Percentage error |
| R² | $1 - \frac{SS_{res}}{SS_{tot}}$ | Variance explained |

---

## 3. API Endpoints

### 3.1 Recommendation APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/recommendations/product/:productId` | Similar products |
| GET | `/api/ai/recommendations/user` | Personalized recs (auth required) |
| GET | `/api/ai/recommendations/popular` | Popular products |
| POST | `/api/ai/recommendations/cart` | Cart-based recs |

**Query Parameters:**
- `limit`: Number of recommendations (default: 10)
- `type`: `rule-based`, `item-based`, `content-based`, `hybrid`

### 3.2 Search APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/search` | Semantic search |
| GET | `/api/ai/search/autocomplete` | Autocomplete suggestions |
| GET | `/api/ai/search/related` | Related searches |

**Query Parameters:**
- `q`: Search query (required)
- `type`: `keyword`, `tfidf`, `embedding`, `hybrid`
- `category`, `brand`, `minPrice`, `maxPrice`: Filters

### 3.3 Review Analysis APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/reviews/analyze/:reviewId` | Analyze single review (admin) |
| GET | `/api/ai/reviews/sentiment/:productId` | Product sentiment summary |
| POST | `/api/ai/reviews/analyze-text` | Analyze text (testing) |
| POST | `/api/ai/reviews/analyze-all` | Batch analysis (admin) |

### 3.4 Forecasting APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/forecast` | Sales forecast (admin) |
| GET | `/api/ai/forecast/historical` | Historical data |
| GET | `/api/ai/forecast/categories` | Category breakdown |

**Query Parameters:**
- `periods`: Forecast periods (default: 30)
- `algorithm`: `moving_average`, `exponential`, `linear`, `holts`, `ensemble`

### 3.5 Chatbot APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/chatbot/message` | Send message |
| GET | `/api/ai/chatbot/history/:sessionId` | Get history |
| POST | `/api/ai/chatbot/end/:sessionId` | End conversation |

### 3.6 Evaluation APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/evaluate/:modelType/:modelName` | Evaluate model (admin) |
| POST | `/api/ai/evaluate/all` | Run all evaluations |
| GET | `/api/ai/evaluate/report` | Generate thesis report |

### 3.7 Utility APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/track` | Track user interaction |
| POST | `/api/ai/embeddings/generate` | Generate embeddings (admin) |
| POST | `/api/ai/tfidf/initialize` | Initialize TF-IDF (admin) |

---

## 4. Database Schemas

### 4.1 UserInteraction

```javascript
{
  user: ObjectId (ref: User),      // null for guests
  product: ObjectId (ref: Product),
  interactionType: enum ['view', 'quick_view', 'cart_add', 'cart_remove', 
                         'wishlist_add', 'wishlist_remove', 'purchase', 
                         'review', 'click', 'share'],
  weight: Number,                   // Auto-calculated
  sessionId: String,
  source: enum ['search', 'recommendation', 'category', 'direct', 'ad'],
  metadata: Object,
  createdAt: Date
}
```

### 4.2 ProductEmbedding

```javascript
{
  product: ObjectId (ref: Product),
  version: String,
  embedding: {
    type: enum ['tf-idf', 'word2vec', 'bert', 'custom'],
    vector: [Number],              // 1536 dimensions
    textContent: String
  },
  metadata: Object,
  updatedAt: Date
}
```

### 4.3 ReviewAnalysis

```javascript
{
  review: ObjectId (ref: Review),
  product: ObjectId (ref: Product),
  sentiment: {
    score: Number,                  // -1 to 1
    label: enum ['positive', 'neutral', 'negative'],
    confidence: Number,
    method: String
  },
  aspects: [{
    aspect: String,
    sentiment: String,
    score: Number
  }],
  spam: {
    isSpam: Boolean,
    score: Number,
    flags: [String]
  },
  processedAt: Date
}
```

### 4.4 SalesForecast

```javascript
{
  forecastType: enum ['daily', 'weekly', 'monthly'],
  scope: { type: String, id: ObjectId },
  historicalData: [{
    date: Date,
    value: Number,
    orderCount: Number
  }],
  forecastResults: [{
    algorithm: String,
    predictions: [{
      date: Date,
      value: Number,
      confidenceInterval: { lower: Number, upper: Number }
    }],
    metrics: {
      mape: Number,
      rmse: Number,
      mae: Number
    }
  }],
  anomalies: [{ date: Date, expected: Number, actual: Number, deviation: Number }],
  insights: [{ type: String, description: String, severity: String }],
  generatedAt: Date
}
```

### 4.5 ChatbotConversation

```javascript
{
  sessionId: String (unique),
  user: ObjectId (ref: User),
  messages: [{
    role: enum ['user', 'bot', 'system'],
    content: String,
    intent: String,
    entities: Object,
    confidence: Number,
    timestamp: Date
  }],
  context: {
    lastIntent: String,
    lastEntities: Object,
    conversationState: enum ['started', 'greeting', 'querying', 
                             'responding', 'ended'],
    followUpExpected: Boolean,
    pendingAction: Object
  },
  metadata: Object,
  satisfaction: Number,
  createdAt: Date,
  updatedAt: Date,
  expireAt: Date                    // TTL 30 days
}
```

### 4.6 ModelEvaluation

```javascript
{
  modelType: enum ['recommendation', 'search', 'sentiment', 
                   'forecasting', 'chatbot'],
  modelName: String,
  version: String,
  evaluation: {
    startTime: Date,
    endTime: Date,
    datasetSize: Number,
    testSetSize: Number,
    kFolds: Number
  },
  metrics: {
    recommendation: {
      precisionAtK: Object,         // { k5, k10, k20 }
      recallAtK: Object,
      f1AtK: Object,
      ndcgAtK: Object,
      mrr: Number,
      hitRate: Number,
      coverage: Number,
      diversity: Number
    },
    classification: {
      accuracy: Number,
      precision: Number,
      recall: Number,
      f1Score: Number,
      confusionMatrix: Object
    },
    regression: {
      mae: Number,
      rmse: Number,
      mape: Number,
      r2Score: Number
    }
  },
  comparison: [{
    comparedWith: String,
    improvement: Object
  }],
  createdAt: Date
}
```

---

## 5. File Structure

```
backend/
├── models/
│   ├── UserInteraction.js      # Interaction tracking
│   ├── ProductEmbedding.js     # Vector embeddings  
│   ├── ReviewAnalysis.js       # NLP analysis results
│   ├── SalesForecast.js        # Time series forecasts
│   ├── ChatbotConversation.js  # Chat history
│   └── ModelEvaluation.js      # Evaluation metrics
│
├── services/
│   └── ai/
│       ├── index.js                    # Central exports
│       ├── RecommendationService.js    # 5-level recommendations
│       ├── SemanticSearchService.js    # TF-IDF + hybrid search
│       ├── ReviewAnalysisService.js    # Sentiment + spam detection
│       ├── SalesForecastingService.js  # Time series algorithms
│       ├── ChatbotService.js           # Intent + entity + response
│       └── ModelEvaluationService.js   # Evaluation metrics
│
└── routes/
    └── ai.js                   # All AI endpoints
```

---

## 6. Hướng dẫn Sử dụng

### 6.1 Khởi tạo TF-IDF

```bash
# Admin API call
POST /api/ai/tfidf/initialize
Authorization: Bearer <admin_token>
```

### 6.2 Generate Embeddings

```bash
POST /api/ai/embeddings/generate
Authorization: Bearer <admin_token>
```

### 6.3 Track User Interaction

```javascript
// Frontend code
fetch('/api/ai/track', {
  method: 'POST',
  body: JSON.stringify({
    productId: '...',
    interactionType: 'view',
    sessionId: getSessionId(),
    metadata: { source: 'search' }
  })
});
```

### 6.4 Get Recommendations

```javascript
// Similar products
const recs = await fetch(`/api/ai/recommendations/product/${productId}?type=hybrid&limit=10`);

// Cart recommendations  
const cartRecs = await fetch('/api/ai/recommendations/cart', {
  method: 'POST',
  body: JSON.stringify({ cartItems: [...] })
});
```

### 6.5 Semantic Search

```javascript
const results = await fetch(`/api/ai/search?q=laptop gaming&type=hybrid&limit=20`);
```

### 6.6 Chatbot Integration

```javascript
const response = await fetch('/api/ai/chatbot/message', {
  method: 'POST',
  body: JSON.stringify({
    sessionId: 'unique-session-id',
    message: 'Xin chào, tôi muốn tìm laptop gaming'
  })
});
```

### 6.7 Generate Thesis Report

```bash
GET /api/ai/evaluate/report
Authorization: Bearer <admin_token>
```

---

## 7. Kết quả Demo (Expected)

### 7.1 Recommendation Metrics

| Model | Precision@10 | Recall@10 | NDCG@10 |
|-------|--------------|-----------|---------|
| Rule-based | 0.15-0.25 | 0.10-0.20 | 0.20-0.30 |
| User-based CF | 0.20-0.35 | 0.15-0.25 | 0.25-0.40 |
| Item-based CF | 0.25-0.40 | 0.18-0.30 | 0.30-0.45 |
| Hybrid | 0.30-0.50 | 0.20-0.35 | 0.35-0.55 |

### 7.2 Sentiment Analysis

| Metric | Expected Value |
|--------|----------------|
| Accuracy | 70-80% |
| Precision | 65-75% |
| Recall | 70-80% |
| F1-Score | 67-77% |

### 7.3 Sales Forecasting

| Metric | Moving Avg | Exp. Smooth | Holt's | Ensemble |
|--------|------------|-------------|--------|----------|
| MAPE | 20-30% | 15-25% | 12-20% | 10-18% |
| RMSE | varies | varies | varies | lowest |

---

## 8. Tài liệu Tham khảo

1. **Collaborative Filtering**: Breese, J. S., Heckerman, D., & Kadie, C. (1998). Empirical analysis of predictive algorithms for collaborative filtering.

2. **TF-IDF**: Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval.

3. **Cosine Similarity**: Singhal, A. (2001). Modern information retrieval: A brief overview.

4. **Holt's Linear Trend**: Holt, C. C. (1957). Forecasting seasonals and trends by exponentially weighted moving averages.

5. **Recommendation Metrics**: Herlocker, J. L., Konstan, J. A., Terveen, L. G., & Riedl, J. T. (2004). Evaluating collaborative filtering recommender systems.

---

**Tác giả**: AI Service Layer - TechStore E-commerce  
**Version**: 1.0  
**Ngày tạo**: 2024
