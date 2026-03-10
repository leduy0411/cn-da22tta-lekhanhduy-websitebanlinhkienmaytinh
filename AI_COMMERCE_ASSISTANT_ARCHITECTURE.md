# AI Commerce Assistant - Production Architecture

## 🏗️ System Overview

A next-generation AI commerce assistant for e-commerce platforms, built with multi-agent architecture and advanced RAG (Retrieval-Augmented Generation) capabilities.

## 📐 Architecture Design

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│                   (ChatGPT-like Chat UI)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│                  POST /api/ai/chat                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Conversation Memory                          │
│          (Store/Retrieve Chat History)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Intent Detector                            │
│   Analyze: product_search, recommendation, comparison,       │
│            pc_build, knowledge_question, greeting            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 AI Reasoning Planner                         │
│          Generate execution plan with steps                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI Router                               │
│           Route to appropriate agent(s)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────┴─────────────┐
         │    Multi-Agent System     │
         └─────────────┬─────────────┘
                       │
     ┌─────────────────┼─────────────────┐
     │                 │                 │
     ▼                 ▼                 ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Product │     │Recommend│     │Comparison│
│  Search │     │  Agent  │     │  Agent   │
│  Agent  │     └─────────┘     └─────────┘
└─────────┘           │               │
     │          ┌─────────┐     ┌─────────┐
     │          │PCBuilder│     │Knowledge│
     │          │  Agent  │     │  Agent  │
     │          └─────────┘     └─────────┘
     │                 │               │
     └─────────────────┴───────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │      Tool System         │
         │  (Dynamic Tool Calling)  │
         └───────────┬──────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
      ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Hybrid  │  │ Vector   │  │  PC      │
│  Search  │  │   RAG    │  │ Builder  │
│  Engine  │  │  Engine  │  │ Advisor  │
└──────────┘  └──────────┘  └──────────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   MongoDB Database    │
         │  - Products           │
         │  - Embeddings         │
         │  - Conversations      │
         │  - User Behavior      │
         └───────────────────────┘
```

## 🎯 Core Components

### 1. Intent Detector (`IntentDetector.js`)
Analyzes user messages to determine intent:
- **product_search**: "Laptop gaming dưới 30 triệu"
- **recommendation**: "Gợi ý laptop cho lập trình"
- **comparison**: "So sánh RTX 4060 và RTX 4070"
- **pc_build**: "Build PC gaming 40 triệu"
- **knowledge_question**: "SSD là gì?"
- **greeting**: "Xin chào"

**Technology**: 
- Pattern matching with regex
- Keyword extraction
- Entity recognition (price, brand, category)
- Confidence scoring

### 2. AI Reasoning Planner (`ReasoningPlanner.js`)
Creates execution plans based on intent:

**Example 1**: "Laptop gaming dưới 30 triệu"
```javascript
{
  intent: "product_search",
  plan: [
    { step: 1, action: "detect_product_category", params: { query: "laptop gaming" } },
    { step: 2, action: "search_products", params: { category: "laptop", maxPrice: 30000000 } },
    { step: 3, action: "rank_results", params: { criteria: ["price", "gaming_specs", "rating"] } }
  ],
  estimatedTools: ["searchProducts", "rankBySpecs"],
  agent: "ProductSearchAgent"
}
```

**Example 2**: "So sánh RTX 4060 và RTX 4070"
```javascript
{
  intent: "comparison",
  plan: [
    { step: 1, action: "fetch_product_specs", params: { products: ["RTX 4060", "RTX 4070"] } },
    { step: 2, action: "generate_comparison", params: { attributes: ["performance", "price", "power"] } },
    { step: 3, action: "recommend_best_option", params: { criteria: "value_for_money" } }
  ],
  estimatedTools: ["getProductDetails", "compareProducts"],
  agent: "ComparisonAgent"
}
```

### 3. AI Router (`AIRouter.js`)
Routes requests to appropriate agents:
- Selects agent based on intent and plan
- Manages agent orchestration
- Handles multi-agent collaboration
- Aggregates results

### 4. Multi-Agent System

#### **ProductSearchAgent** (`agents/ProductSearchAgent.js`)
Handles product search queries:
- Uses HybridSearchEngine (keyword + semantic)
- Applies filters (price, category, brand, specs)
- Ranks results by relevance
- Provides detailed product information

**Tools**: searchProducts, filterBySpecs, rankResults

#### **RecommendationAgent** (`agents/RecommendationAgent.js`)
Provides personalized recommendations:
- User behavior analysis
- Collaborative filtering
- Content-based filtering
- Hybrid recommendation
- Context-aware suggestions

**Tools**: recommendProducts, getUserPreferences, analyzeHistory

#### **ComparisonAgent** (`agents/ComparisonAgent.js`)
Compares products side-by-side:
- Fetch product specifications
- Generate comparison tables
- Highlight differences
- Provide recommendation based on use case

**Tools**: compareProducts, getProductDetails, analyzeSpecs

#### **PCBuilderAgent** (`agents/PCBuilderAgent.js`)
Builds complete PC configurations:
- Budget-based component selection
- Compatibility checking
- Performance balancing
- Alternative suggestions

**Tools**: buildPCConfiguration, checkCompatibility, suggestAlternatives

#### **KnowledgeAgent** (`agents/KnowledgeAgent.js`)
Answers general questions:
- Product knowledge (specs, features)
- Technical concepts
- Purchase advice
- Store policies

**Tools**: searchKnowledge, generateExplanation

### 5. Tool System (`ToolSystem.js`)
Dynamic tool calling framework:

```javascript
const tools = {
  searchProducts: {
    name: "searchProducts",
    description: "Search products with filters",
    parameters: {
      query: "string",
      category: "string",
      minPrice: "number",
      maxPrice: "number",
      brand: "string"
    },
    execute: async (params) => { /* implementation */ }
  },
  
  compareProducts: {
    name: "compareProducts",
    description: "Compare multiple products",
    parameters: {
      productIds: "array"
    },
    execute: async (params) => { /* implementation */ }
  },
  
  buildPCConfiguration: {
    name: "buildPCConfiguration",
    description: "Build PC with budget",
    parameters: {
      budget: "number",
      purpose: "string" // gaming, workstation, office
    },
    execute: async (params) => { /* implementation */ }
  },
  
  // ... more tools
};
```

### 6. Hybrid Search Engine (`HybridSearchEngine.js`)
Combines keyword and semantic search:

```javascript
{
  keywordResults: [...], // MongoDB text search
  semanticResults: [...], // Vector similarity search
  fusedResults: [...],   // Weighted combination
  ranking: {
    relevance: 0.4,
    price: 0.2,
    popularity: 0.2,
    specs: 0.2
  }
}
```

**Ranking Factors**:
- Relevance (keyword + semantic match)
- Price fit (matches budget)
- Popularity (sales, views, ratings)
- Specs match (meets requirements)

### 7. Vector RAG Engine (`VectorRAGEngine.js`)
Enhanced RAG with vector embeddings:

**Steps**:
1. Convert product descriptions to embeddings
2. Store vectors in ProductEmbedding collection
3. Query embedding generation
4. Vector similarity search (cosine similarity)
5. Retrieve top-K relevant products
6. Build context for AI model
7. Generate response with Gemini

**Embedding Model**: TF-IDF (current) / Sentence Transformers (upgrade)

### 8. PC Builder Advisor (`PCBuilderAdvisor.js`)
Intelligent PC configuration builder:

**Compatibility Rules**:
```javascript
const compatibilityRules = {
  cpu_motherboard: {
    "Intel 12th/13th/14th Gen": ["LGA1700"],
    "AMD Ryzen 7000": ["AM5"],
    "AMD Ryzen 5000": ["AM4"]
  },
  
  psu_gpu: {
    "RTX 4090": { minWattage: 850 },
    "RTX 4080": { minWattage: 750 },
    "RTX 4070": { minWattage: 650 },
    "RTX 4060": { minWattage: 550 }
  },
  
  ram_motherboard: {
    "DDR5": ["AM5", "LGA1700"],
    "DDR4": ["AM4", "LGA1200"]
  }
};
```

**Build Process**:
1. Determine budget allocation (% for each component)
2. Select CPU (30-35% of budget)
3. Select GPU (35-40% for gaming)
4. Select compatible motherboard
5. Select RAM (DDR4/DDR5 based on motherboard)
6. Select SSD
7. Select PSU (based on power requirements)
8. Select case
9. Validate compatibility
10. Provide alternatives if needed

### 9. Conversation Memory (`ConversationMemoryService.js`)
Enhanced conversation management:

```javascript
{
  sessionId: "uuid",
  userId: "user_id",
  messages: [
    {
      role: "user",
      content: "Laptop gaming dưới 30 triệu",
      timestamp: "2025-01-10T10:00:00Z",
      metadata: {
        intent: "product_search",
        entities: { category: "laptop", maxPrice: 30000000 }
      }
    },
    {
      role: "assistant",
      content: "Dưới đây là...",
      timestamp: "2025-01-10T10:00:05Z",
      metadata: {
        agent: "ProductSearchAgent",
        products: ["id1", "id2", "id3"],
        toolsUsed: ["searchProducts", "rankResults"]
      }
    }
  ],
  context: {
    interestedProducts: ["id1", "id2"],
    priceRange: { min: 0, max: 30000000 },
    categories: ["laptop"],
    brands: ["ASUS", "MSI"]
  },
  summary: "User looking for gaming laptop under 30M, interested in ASUS/MSI"
}
```

### 10. User Behavior Tracking (`BehaviorTracker.js`)
Track and analyze user behavior:

```javascript
{
  userId: "user_id",
  sessionId: "session_id",
  behaviors: [
    {
      type: "viewed_product",
      productId: "product_id",
      timestamp: "2025-01-10T10:00:00Z",
      source: "search"
    },
    {
      type: "searched_query",
      query: "laptop gaming",
      resultCount: 15,
      clickedProducts: ["id1", "id2"],
      timestamp: "2025-01-10T10:00:00Z"
    },
    {
      type: "received_recommendation",
      products: ["id3", "id4"],
      agent: "RecommendationAgent",
      clicked: ["id3"],
      timestamp: "2025-01-10T10:05:00Z"
    }
  ],
  preferences: {
    favoriteCategories: ["laptop", "gaming"],
    favoriteBrands: ["ASUS", "MSI"],
    priceRange: { min: 20000000, max: 40000000 },
    specs: { cpu: "i7", gpu: "RTX 4060" }
  }
}
```

## 📊 Database Schema

### Collections

#### `products`
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  category: String, // laptop, pc, gpu, cpu, ram, etc.
  brand: String,
  price: Number,
  salePrice: Number,
  stock: Number,
  rating: Number,
  reviews: Number,
  images: [String],
  specifications: {
    cpu: String,
    gpu: String,
    ram: String,
    storage: String,
    // ... category-specific specs
  },
  compatibility: {
    socket: String, // for CPU/motherboard
    formFactor: String, // for case
    powerRequirement: Number, // for PSU
    ramType: String // DDR4, DDR5
  }
}
```

#### `product_embeddings`
```javascript
{
  _id: ObjectId,
  product: ObjectId (ref: Product),
  sourceText: String,
  embedding: [Number], // 384 or 768 dimensions
  dimension: Number,
  embeddingModel: String,
  normalizedEmbedding: [Number],
  metadata: {
    productName: String,
    category: String,
    brand: String,
    priceRange: String
  },
  status: String, // completed, pending, failed
  createdAt: Date,
  updatedAt: Date
}
```

#### `chat_sessions`
```javascript
{
  _id: ObjectId,
  sessionId: String (unique),
  userId: ObjectId (ref: User) | null,
  messages: [{
    role: String, // user | assistant
    content: String,
    timestamp: Date,
    metadata: {
      intent: String,
      entities: Object,
      agent: String,
      toolsUsed: [String],
      products: [ObjectId]
    }
  }],
  context: {
    interestedProducts: [ObjectId],
    priceRange: { min: Number, max: Number },
    categories: [String],
    brands: [String]
  },
  summary: String,
  status: String, // active, archived
  createdAt: Date,
  updatedAt: Date
}
```

#### `user_behaviors`
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  sessionId: String,
  behaviors: [{
    type: String, // viewed_product, searched_query, received_recommendation, added_to_cart, purchased
    timestamp: Date,
    productId: ObjectId,
    query: String,
    metadata: Object
  }],
  preferences: {
    favoriteCategories: [String],
    favoriteBrands: [String],
    priceRange: { min: Number, max: Number },
    specs: Object
  },
  createdAt: Date,
  updatedAt: Date
}
```

## 🔄 API Flow

### Main Chat Endpoint

**Request**:
```http
POST /api/ai/chat
Content-Type: application/json

{
  "message": "Laptop gaming dưới 30 triệu",
  "sessionId": "uuid",
  "userId": "user_id" (optional)
}
```

**Processing Flow**:
1. Load conversation memory
2. Detect intent → "product_search"
3. Create reasoning plan
4. Route to ProductSearchAgent
5. Agent uses tools: searchProducts → rankResults
6. HybridSearchEngine: keyword + semantic search
7. VectorRAGEngine: build context
8. Gemini API: generate response
9. Save to conversation memory
10. Track user behavior
11. Return response

**Response**:
```json
{
  "success": true,
  "sessionId": "uuid",
  "reply": "Dưới đây là top 5 laptop gaming dưới 30 triệu...",
  "products": [
    {
      "_id": "product_id",
      "name": "ASUS TUF Gaming A15",
      "price": 25990000,
      "image": "url",
      "rating": 4.5,
      "stock": 10,
      "score": 0.95,
      "matchReason": "Gaming laptop, trong tầm giá, specs phù hợp"
    }
  ],
  "metadata": {
    "intent": "product_search",
    "agent": "ProductSearchAgent",
    "toolsUsed": ["searchProducts", "rankResults"],
    "executionTime": 1250
  }
}
```

## 🚀 Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB 6+
- **AI Model**: Google Gemini API
- **Vector Search**: TF-IDF / Sentence Transformers
- **Authentication**: JWT

### Frontend
- **Framework**: React 18+
- **UI Library**: Custom components
- **Markdown**: react-markdown
- **State Management**: React Context/Hooks
- **HTTP Client**: Axios

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Environment**: .env configuration

## 📈 Performance Optimization

1. **Caching**:
   - Cache search results (Redis/Memory)
   - Cache embeddings
   - Cache tool execution results

2. **Indexing**:
   - MongoDB text indexes
   - Compound indexes for filters
   - Embedding similarity indexes

3. **Async Processing**:
   - Background embedding generation
   - Async tool execution
   - Parallel agent calls

4. **Response Streaming**:
   - SSE (Server-Sent Events) for real-time responses
   - Chunk-based streaming from Gemini

## 🔐 Security

1. **Authentication**: JWT-based user authentication
2. **Rate Limiting**: Prevent API abuse
3. **Input Validation**: Sanitize user inputs
4. **API Key Protection**: Secure Gemini API key
5. **Error Handling**: No sensitive data in errors

## 📚 Next Steps

1. Deploy to production environment
2. Monitor performance metrics
3. Collect user feedback
4. Improve agent intelligence
5. Add more tools and capabilities
6. Implement A/B testing
7. Scale infrastructure

---

**Version**: 2.0.0  
**Last Updated**: 2026-03-10  
**Status**: Production-Ready
