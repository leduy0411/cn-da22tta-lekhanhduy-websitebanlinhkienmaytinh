# 🤖 Hệ Thống Gợi Ý AI Nâng Cao - TechStore

## Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Frontend                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │   Home   │  │ Product  │  │   Cart   │  │   Admin AI Page  │   │
│  │(trending)│  │ (similar)│  │(cross-sell│  │ (training/AB test)│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │              │                  │             │
│  ┌────▼──────────────▼──────────────▼──────────────────▼─────────┐  │
│  │              useRecommendations Hooks (V2 → V1 fallback)      │  │
│  └────────────────────────────┬──────────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────────┘
                                │ HTTP API
┌───────────────────────────────▼──────────────────────────────────────┐
│                      Node.js Backend (Express)                        │
│  ┌─────────────────────┐    ┌────────────────────────────────────┐   │
│  │  /api/ai/* (V1)     │    │  /api/ai/v2/* (V2 Routes)         │   │
│  │  RecommendationSvc  │◄───│  AIServiceClient → Python proxy   │   │
│  │  (JS fallback)      │    │  + RecommendationLog (A/B test)   │   │
│  └─────────────────────┘    └──────────────┬─────────────────────┘   │
└────────────────────────────────────────────┼──────────────────────────┘
                                             │ HTTP :8000
┌────────────────────────────────────────────▼──────────────────────────┐
│                    Python AI Service (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    HybridRecommender                          │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐          │    │
│  │  │  SVD    │ │  ALS    │ │  NCF    │ │Association│          │    │
│  │  │(explicit│ │(implicit│ │(Neural  │ │  Rules    │          │    │
│  │  │feedback)│ │feedback)│ │  CF)    │ │(FP-Growth)│          │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └──────────┘          │    │
│  │  ┌─────────────────┐  ┌────────────────────┐               │    │
│  │  │  Content-Based   │  │     FAISS Index     │               │    │
│  │  │(Sentence-BERT)  │  │  (Vector Similarity) │               │    │
│  │  └─────────────────┘  └────────────────────┘               │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ APScheduler  │  │ DataProcessor│  │   A/B Test    │              │
│  │(daily train) │  │(matrix build)│  │ (3 variants)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└────────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│                        MongoDB (Shared)                               │
│  Collections: products, userinteractions, orders, users,             │
│              productembeddings, recommendationlogs                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Cấu Trúc Thư Mục Mới

```
ai-service/                          # Python FastAPI Microservice
├── .env.example                     # Cấu hình môi trường
├── .dockerignore
├── Dockerfile                       # Docker image cho AI service
├── requirements.txt                 # Python dependencies
├── config.py                        # Settings & configuration
├── database.py                      # Motor async MongoDB driver
├── data_processor.py                # Xây dựng User-Item matrix, features
├── main.py                          # FastAPI application + endpoints
├── recommendation_engine.py         # HybridRecommender (orchestrator)
└── models/
    ├── __init__.py
    ├── matrix_factorization.py      # SVD + ALS models
    ├── association_rules.py         # Apriori/FP-Growth
    ├── neural_cf.py                 # NeuMF (PyTorch Deep Learning)
    └── content_based.py             # Sentence-BERT + FAISS

backend/                             # Node.js Express (bổ sung)
├── models/
│   └── RecommendationLog.js         # A/B test logging model
├── services/ai/
│   └── AIServiceClient.js           # HTTP client → Python service
├── routes/v2/
│   └── recommendations.js           # V2 API endpoints with fallback
└── Dockerfile                       # Docker image cho backend

frontend/                            # React (bổ sung)
├── src/hooks/
│   └── useRecommendations.js        # Custom hooks (V2 + fallback)
└── src/components/
    ├── RecommendationSection.js      # Reusable recommendation display
    └── RecommendationSection.css     # Styling + skeleton loading

docker-compose.yml                   # Full stack orchestration
.env.example                         # Docker env template
```

---

## 🧠 Các Thuật Toán

### 1. Matrix Factorization (SVD)
- **Mục đích**: Phân tích ma trận User-Item cho explicit feedback (ratings)
- **Kỹ thuật**: scipy.sparse.linalg.svds với mean-centering
- **Tham số**: n_factors=50 (latent dimensions)
- **Output**: Dự đoán rating cho user-item pairs chưa tương tác

### 2. Alternating Least Squares (ALS)  
- **Mục đích**: Implicit feedback (views, clicks, purchases)
- **Kỹ thuật**: ALS với confidence weighting C = 1 + α*R
- **Tham số**: n_factors=50, alpha=40, regularization=0.1, iterations=15
- **Output**: Latent vectors cho users và items

### 3. Neural Collaborative Filtering (NCF/NeuMF)
- **Mục đích**: Deep Learning-based CF, capture non-linear patterns
- **Kiến trúc**: GMF + MLP branches → combined prediction
- **Framework**: PyTorch
- **Training**: BCE loss, Adam optimizer, negative sampling 4:1
- **Output**: User-item interaction prediction probabilities

### 4. Association Rules (FP-Growth)
- **Mục đích**: Market basket analysis, cross-sell recommendations
- **Library**: mlxtend
- **Tham số**: min_support=0.005, min_confidence=0.05, min_lift=1.0
- **Output**: If-then rules (mua A → gợi ý B) với confidence scores

### 5. Content-Based (Sentence-BERT + FAISS)
- **Mục đích**: Tìm sản phẩm tương tự dựa trên nội dung text
- **Embedding model**: all-MiniLM-L6-v2 (384 dimensions)
- **Vector DB**: FAISS IndexFlatIP (inner product = cosine similarity)
- **Output**: K nearest neighbors trong không gian embedding

### 6. Hybrid Orchestrator
- **Kết hợp**: Weighted fusion của tất cả models
- **A/B Testing**: 3 variant trọng số (balanced / CF-heavy / content-heavy)
- **Cold-start**: Fallback sang popularity + content-based khi user mới
- **Diversity**: Post-processing loại bỏ duplicates, đảm bảo đa dạng

---

## 📊 Data Flow

### Training Pipeline (daily batch)
```
MongoDB collections
    │
    ▼
DataProcessor.load_interactions()     → User-Item interaction matrix (scipy sparse)
DataProcessor.load_products()         → Product features
DataProcessor.load_orders()           → Transaction data
DataProcessor.build_transaction_matrix() → Boolean basket matrix
    │
    ├── SVD Model.fit(user_item_matrix)
    ├── ALS Model.fit(user_item_matrix)  
    ├── NCF Model.train(interactions, epochs=20)
    ├── Association Model.fit(transaction_matrix)
    └── ContentBased.build_index(products)  → FAISS index
    │
    ▼
model_data/ (saved models: .pkl, .pt, .faiss)
```

### Recommendation Request Flow
```
Client request → /api/ai/v2/recommend/user/:id
    │
    ▼
Backend V2 Route → AIServiceClient.getUserRecommendations()
    │
    ▼ (HTTP)
Python FastAPI → HybridRecommender.recommend_for_user()
    │
    ├── SVD predictions (if user has history)
    ├── NCF predictions (if model trained)
    ├── Popularity fallback (cold-start)
    │
    ▼
    Weighted fusion + diversity enforcement + A/B variant selection
    │
    ▼ (enriched with product details from MongoDB)
Response: { recommendations: [...], source, scores, abVariant }
    │
    ▼
Backend logs to RecommendationLog → Return to frontend
    │
    ▼
useRecommendations hook → RecommendationSection component
```

---

## 🔌 API Endpoints

### V2 Recommendation Endpoints (Python AI Service powered)

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/ai/v2/recommend/user/:userId` | Gợi ý cá nhân hóa |
| GET | `/api/ai/v2/recommend/product/:productId` | Sản phẩm tương tự |
| POST | `/api/ai/v2/recommend/cart` | Gợi ý từ giỏ hàng (cross-sell) |
| GET | `/api/ai/v2/recommend/trending` | Sản phẩm xu hướng |
| POST | `/api/ai/v2/track` | Ghi nhận tương tác |
| POST | `/api/ai/v2/track-click` | Theo dõi click cho CTR |
| POST | `/api/ai/v2/train` | Kích hoạt training (admin) |
| GET | `/api/ai/v2/status` | Trạng thái AI service |
| GET | `/api/ai/v2/training/report` | Báo cáo training |
| GET | `/api/ai/v2/ab-test/results` | Kết quả A/B testing |

### Python FastAPI Endpoints (internal)

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/health` | Health check |
| GET | `/status` | Service status & model info |
| POST | `/train` | Trigger model training |
| GET | `/recommend/user/{id}` | User recommendations |
| GET | `/recommend/product/{id}` | Product recommendations |
| POST | `/recommend/cart` | Cart recommendations |
| GET | `/recommend/trending` | Trending products |
| POST | `/track` | Track interaction event |
| GET | `/search?q=...` | Semantic search (FAISS) |

---

## ⚡ A/B Testing

3 variant configurations được random cho mỗi user:

| Variant | SVD | NCF | Popularity | Content | Association |
|---------|-----|-----|------------|---------|-------------|
| **A** (balanced) | 0.3 | 0.3 | 0.1 | 0.2 | 0.1 |
| **B** (CF-heavy) | 0.4 | 0.4 | 0.05 | 0.1 | 0.05 |
| **C** (content-heavy) | 0.15 | 0.15 | 0.1 | 0.4 | 0.2 |

Metrics tracked per variant:
- **CTR** (Click-Through Rate): clicks / impressions
- **Conversion Rate**: purchases / impressions
- **Average latency**: response time

---

## 🚀 Hướng Dẫn Chạy

### Development (không Docker)

```bash
# 1. Chạy Python AI Service
cd ai-service
pip install -r requirements.txt
cp .env.example .env  # sửa MONGODB_URI
python main.py

# 2. Chạy Backend (terminal khác)
cd backend
npm install
# Thêm AI_SERVICE_URL=http://localhost:8000 vào .env
node server.js

# 3. Chạy Frontend (terminal khác)  
cd frontend
npm start
```

### Production (Docker)

```bash
# Copy và sửa .env
cp .env.example .env

# Build và chạy tất cả services
docker-compose up -d --build

# Kiểm tra logs
docker-compose logs -f ai-service

# Trigger training lần đầu
curl -X POST http://localhost:5000/api/ai/v2/train
```

### Kiểm tra health

```bash
# Python AI Service
curl http://localhost:8000/health

# Backend
curl http://localhost:5000/api/ai/v2/status

# Test recommendation
curl http://localhost:5000/api/ai/v2/recommend/trending?limit=5
```

---

## 📈 Scaling Strategy

1. **Horizontal**: Tăng workers trong uvicorn (`--workers 4`)
2. **Caching**: Redis layer giữa backend và AI service (TTL 5 phút)
3. **Model serving**: Tách training worker riêng, serve bằng pre-computed results
4. **FAISS**: Chuyển từ IndexFlatIP sang IndexIVFFlat khi >100K products
5. **Database**: MongoDB read replicas cho queries, separate write concern cho training

---

## 📋 Performance Targets

| Metric | Target | Thực tế |
|--------|--------|---------|
| API latency (p95) | < 300ms | Measured after deploy |
| Training time (full) | < 30 min | Depends on data size |
| Memory (AI service) | < 2GB | ~1.5GB with FAISS+models |
| CTR improvement | > 15% vs random | Measured via A/B test |
