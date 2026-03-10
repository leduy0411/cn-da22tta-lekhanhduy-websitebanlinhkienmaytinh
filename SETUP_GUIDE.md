# AI Commerce Assistant - Setup & Usage Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+
- Gemini API Key (get from https://ai.google.dev/)

### Installation

**1. Install Dependencies**
```bash
cd backend
npm install
```

**2. Configure Environment Variables**

Create or update `.env` file:
```env
# MongoDB
MONGODB_URI=mongodb+srv://your-connection-string

# Gemini API
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-2.0-flash

# Server
PORT=5000
NODE_ENV=production

# JWT (existing)
JWT_SECRET=your-jwt-secret
```

**3. Start the Server**
```bash
# Development
npm run dev

# Production
npm start
```

**4. Verify Installation**

Check health endpoint:
```bash
curl http://localhost:5000/api/ai-assistant/health
```

Expected response:
```json
{
  "success": true,
  "health": {
    "initialized": true,
    "router": {
      "status": "healthy",
      "agents": {
        "count": 5,
        "registered": ["ProductSearchAgent", "RecommendationAgent", "ComparisonAgent", "PCBuilderAgent", "KnowledgeAgent"]
      }
    }
  }
}
```

## 📡 API Endpoints

### Main Chat Endpoint

**POST** `/api/ai-assistant/chat`

Process user message with multi-agent routing.

**Request:**
```json
{
  "message": "Laptop gaming dưới 30 triệu",
  "sessionId": "unique-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "unique-session-id",
  "answer": "Dưới đây là top 5 laptop gaming...",
  "products": [
    {
      "_id": "product_id",
      "name": "ASUS TUF Gaming A15",
      "price": 25990000,
      "brand": "ASUS",
      "rating": 4.5,
      "stock": 10
    }
  ],
  "productCount": 5,
  "metadata": {
    "intent": "product_search",
    "confidence": 0.92,
    "agent": "ProductSearchAgent",
    "executionTime": 1250,
    "plan": {
      "steps": 6,
      "complexity": "moderate"
    }
  }
}
```

### Streaming Chat

**POST** `/api/ai-assistant/chat/stream`

Real-time streaming responses (SSE).

**Request:**
```json
{
  "message": "So sánh RTX 4060 và RTX 4070",
  "sessionId": "session-123"
}
```

**Response:** (Server-Sent Events)
```
data: {"type":"intent","data":{"intent":"comparison","confidence":0.95}}

data: {"type":"plan","data":{"agent":"ComparisonAgent","steps":6}}

data: {"type":"answer","data":"RTX 4060 và RTX 4070..."}

data: {"type":"products","data":[...]}

data: [DONE]
```

### Conversation Management

**GET** `/api/ai-assistant/conversations`

Get user's conversation history.

**GET** `/api/ai-assistant/conversation/:sessionId`

Get specific conversation.

**DELETE** `/api/ai-assistant/conversation/:sessionId`

Delete conversation.

### System Monitoring

**GET** `/api/ai-assistant/health`

Check system health.

**GET** `/api/ai-assistant/stats` (Admin only)

Get detailed statistics.

## 🤖 Agent Capabilities

### 1. ProductSearchAgent

**Handles:**
- Product search queries
- Price inquiries
- Product details

**Example queries:**
- "Laptop gaming dưới 30 triệu"
- "PC văn phòng giá rẻ"
- "Màn hình 144Hz ASUS"

### 2. RecommendationAgent

**Handles:**
- Personalized recommendations
- Product suggestions

**Example queries:**
- "Gợi ý laptop cho sinh viên"
- "Tư vấn PC cho thiết kế đồ họa"
- "Nên mua GPU nào?"

### 3. ComparisonAgent

**Handles:**
- Product comparisons
- Specification analysis

**Example queries:**
- "So sánh RTX 4060 vs RTX 4070"
- "Khác nhau giữa i7 và Ryzen 7"
- "RTX 4080 tốt hơn RTX 4090 chỗ nào"

### 4. PCBuilderAgent

**Handles:**
- PC configuration building
- Compatibility checking
- Component selection

**Example queries:**
- "Build PC gaming 40 triệu"
- "Cấu hình PC workstation 60 triệu"
- "Lắp PC văn phòng giá rẻ"

### 5. KnowledgeAgent

**Handles:**
- Knowledge questions
- Explanations
- Greetings & help

**Example queries:**
- "SSD là gì?"
- "Khác nhau giữa DDR4 và DDR5"
- "NVMe tốt hơn SATA như thế nào?"

## 📊 Architecture Components

### Core System

```
AICommerceAssistant (Main)
├── AIRouter (Routing)
├── IntentDetector (Intent analysis)
├── ReasoningPlanner (Plan creation)
└── ToolSystem (Tool execution)
```

### Agents

```
ProductSearchAgent
RecommendationAgent
ComparisonAgent
PCBuilderAgent
KnowledgeAgent
```

### Engines

```
HybridSearchEngine (Keyword + Semantic)
VectorRAGEngine (RAG with context)
```

### Tools

Available tools:
- `searchProducts` - Product search with filters
- `getProductDetails` - Get product info
- `compareProducts` - Compare multiple products
- `rankResults` - Rank by criteria
- `recommendProducts` - Get recommendations
- `buildPCConfiguration` - Build PC setup
- `checkCompatibility` - Check component compatibility

## 🎯 Intent Detection

System automatically detects:

| Intent | Confidence | Example |
|--------|-----------|---------|
| `product_search` | 0.9 | "Laptop gaming dưới 30 triệu" |
| `recommendation` | 0.85 | "Gợi ý laptop cho lập trình" |
| `comparison` | 0.95 | "So sánh RTX 4060 và RTX 4070" |
| `pc_build` | 0.9 | "Build PC gaming 40 triệu" |
| `knowledge_question` | 0.8 | "SSD là gì?" |
| `greeting` | 0.95 | "Xin chào" |
| `help` | 0.85 | "Giúp tôi" |

## 🔧 Configuration

### Customize Budget Allocation (PC Builder)

Edit `backend/services/ai/agents/PCBuilderAgent.js`:

```javascript
this.budgetAllocation = {
  gaming: {
    cpu: 0.25,
    gpu: 0.40,  // 40% for gaming GPU
    motherboard: 0.10,
    ram: 0.10,
    storage: 0.08,
    psu: 0.05,
    case: 0.02
  },
  workstation: {
    cpu: 0.35,  // 35% for workstation CPU
    gpu: 0.25,
    // ...
  }
};
```

### Customize Intent Patterns

Edit `backend/services/ai/core/IntentDetector.js`:

```javascript
this.intentPatterns = {
  product_search: {
    patterns: [
      /(tìm|search|cho tôi).*(laptop|pc|màn hình)/i,
      // Add your patterns
    ],
    confidence: 0.9
  }
};
```

### Adjust Search Weights

Edit `backend/services/ai/engines/HybridSearchEngine.js`:

```javascript
this.keywordWeight = 0.4;  // 40% keyword
this.semanticWeight = 0.6; // 60% semantic
```

## 📈 Performance Tuning

### Cache Configuration

```javascript
// HybridSearchEngine cache
const cacheOptions = {
  ttl: 300000, // 5 minutes
  max: 100     // Max 100 entries
};
```

### Tool Timeout

```javascript
// ToolSystem timeout
const toolTimeout = 10000; // 10 seconds
```

### Agent Execution Timeout

```javascript
// AIRouter timeout
const agentTimeout = 30000; // 30 seconds
```

## 🧪 Testing

### Test Chat Endpoint

```bash
curl -X POST http://localhost:5000/api/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Laptop gaming dưới 30 triệu",
    "sessionId": "test-session-123"
  }'
```

### Test Different Intents

```bash
# Product Search
curl -X POST http://localhost:5000/api/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Tìm laptop ASUS", "sessionId": "test-1"}'

# Recommendation
curl -X POST http://localhost:5000/api/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Gợi ý laptop cho sinh viên", "sessionId": "test-2"}'

# Comparison
curl -X POST http://localhost:5000/api/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "So sánh RTX 4060 và RTX 4070", "sessionId": "test-3"}'

# PC Build
curl -X POST http://localhost:5000/api/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Build PC gaming 40 triệu", "sessionId": "test-4"}'

# Knowledge
curl -X POST http://localhost:5000/api/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "SSD là gì?", "sessionId": "test-5"}'
```

## 🐛 Troubleshooting

### AI Not Initializing

**Problem:** Agents not registered

**Solution:**
```bash
# Check logs
npm run dev

# Should see:
# ✅ Agent registered: ProductSearchAgent
# ✅ Agent registered: RecommendationAgent
# ...
```

### Gemini API Quota Exceeded

**Problem:** 429 error

**Solutions:**
1. Wait 24 hours for quota reset
2. Create new API key
3. Enable billing ($5-10/month)
4. System works with fallback responses

### Products Not Found

**Problem:** Empty product list

**Solutions:**
1. Check MongoDB connection
2. Verify products in database: `db.products.count()`
3. Create text indexes: `db.products.createIndex({ name: "text", description: "text" })`

### Slow Response Time

**Problem:** >5 seconds response time

**Solutions:**
1. Enable caching
2. Create database indexes
3. Reduce product context limit
4. Use streaming endpoint

## 📚 Advanced Usage

### Custom Agent

Create new agent in `backend/services/ai/agents/`:

```javascript
class CustomAgent {
  constructor() {
    this.name = 'CustomAgent';
    this.capabilities = ['custom_intent'];
  }

  async execute(params) {
    // Your logic here
    return {
      answer: 'Response',
      source: 'CustomAgent'
    };
  }
}

module.exports = new CustomAgent();
```

Register in `AICommerceAssistant.js`:

```javascript
const CustomAgent = require('./agents/CustomAgent');
this.router.registerAgent('CustomAgent', CustomAgent);
```

### Custom Tool

Add to `ToolSystem.js`:

```javascript
this.register({
  name: 'customTool',
  description: 'Custom tool description',
  parameters: {
    param1: { type: 'string', required: true }
  },
  execute: async (params) => {
    // Your logic
    return result;
  }
});
```

## 🔒 Security

1. **API Key Protection:** Never commit `.env` to git
2. **Input Validation:** All inputs sanitized
3. **Rate Limiting:** Implement rate limiting in production
4. **Authentication:** Use JWT auth for user-specific features
5. **Error Handling:** No sensitive data in error responses

## 📞 Support

- **Documentation:** See `AI_COMMERCE_ASSISTANT_ARCHITECTURE.md`
- **API Docs:** See endpoint comments
- **Issues:** Check logs in `console`

---

**Version:** 2.0.0  
**Last Updated:** 2026-03-10  
**Status:** Production-Ready
