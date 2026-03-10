# Frontend Integration Guide

## How to Add AI Chat to Your Application

### Step 1: Install Dependencies

```bash
cd frontend
npm install uuid
```

### Step 2: Add Components to Your App

Edit `src/App.js`:

```javascript
import React from 'react';
import FloatingChatButton from './components/FloatingChatButton';
import './App.css';

function App() {
  return (
    <div className="App">
      {/* Your existing components */}
      
      {/* Add the floating chat button */}
      <FloatingChatButton />
    </div>
  );
}

export default App;
```

### Step 3: Update API Endpoint (Production)

When deploying to production, update the API endpoint in:

**`frontend/src/components/AICommerceChat.js`:**

```javascript
// Change from:
const response = await fetch('http://localhost:5000/api/ai-assistant/chat', {

// To:
const response = await fetch('/api/ai-assistant/chat', {
```

Also update in `loadConversation()` function.

### Step 4: Environment Configuration

Create `.env` in frontend folder:

```env
REACT_APP_API_URL=http://localhost:5000
```

Then update the component:

```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const response = await fetch(`${API_URL}/api/ai-assistant/chat`, {
  // ...
});
```

## Usage Examples

### 1. Inline Chat (Not Floating)

If you want the chat to be part of a page instead of floating:

```javascript
import AICommerceChat from './components/AICommerceChat';

function ShopPage() {
  const [isChatOpen, setIsChatOpen] = useState(true);
  
  return (
    <div className="shop-page">
      <div className="products-section">
        {/* Products */}
      </div>
      
      <div className="chat-section">
        <AICommerceChat 
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </div>
    </div>
  );
}
```

Then modify `.ai-chat-overlay` CSS to not be fullscreen:

```css
.ai-chat-overlay {
  position: relative; /* Instead of fixed */
  background: transparent;
  display: block;
}

.ai-chat-container {
  width: 100%;
  max-width: 100%;
  height: 600px;
}
```

### 2. Custom Trigger Button

```javascript
import { useState } from 'react';
import AICommerceChat from './components/AICommerceChat';

function ProductPage({ product }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const handleAskAI = () => {
    setIsChatOpen(true);
    // Optional: Pre-fill with product question
  };
  
  return (
    <div className="product-page">
      <div className="product-info">
        {/* Product details */}
        <button onClick={handleAskAI}>
          💬 Hỏi AI về sản phẩm này
        </button>
      </div>
      
      <AICommerceChat 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}
```

### 3. With Authentication

Modify `AICommerceChat.js` to include auth token:

```javascript
// Get token from your auth context/store
const token = localStorage.getItem('token');

const response = await fetch('http://localhost:5000/api/ai-assistant/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // Add this
  },
  body: JSON.stringify({
    message: inputMessage,
    sessionId
  })
});
```

## Customization

### Change Color Theme

Edit `AICommerceChat.css`:

```css
/* Purple theme → Blue theme */
.ai-chat-container {
  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
}

.header-btn {
  background: rgba(79, 70, 229, 0.2);
}

/* Update all #667eea to #4f46e5 (indigo) */
/* Update all #764ba2 to #06b6d4 (cyan) */
```

### Add Product Images

Update `renderProductCard` in `AICommerceChat.js`:

```javascript
const renderProductCard = (product) => (
  <div className="product-card" key={product._id}>
    {product.images && product.images[0] && (
      <img 
        src={product.images[0]} 
        alt={product.name}
        className="product-image"
      />
    )}
    <div className="product-info">
      {/* ... existing code ... */}
    </div>
  </div>
);
```

Add CSS:

```css
.product-card {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 12px;
}

.product-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
}
```

### Enable Rich Markdown

Install `react-markdown`:

```bash
npm install react-markdown
```

Update component:

```javascript
import ReactMarkdown from 'react-markdown';

// In render:
<ReactMarkdown className="message-text">
  {msg.content}
</ReactMarkdown>
```

### Add Voice Input

Install speech recognition:

```bash
npm install react-speech-recognition
```

Add to `AICommerceChat.js`:

```javascript
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const AICommerceChat = ({ isOpen, onClose }) => {
  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  
  useEffect(() => {
    if (transcript) {
      setInputMessage(transcript);
    }
  }, [transcript]);
  
  const handleVoiceInput = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ language: 'vi-VN' });
    }
  };
  
  return (
    {/* ... existing code ... */}
    <div className="ai-chat-input">
      <button onClick={handleVoiceInput}>
        {listening ? '⏹️' : '🎤'}
      </button>
      <textarea value={inputMessage} {...} />
      <button onClick={handleSend}>🚀</button>
    </div>
  );
};
```

## Testing

### Test Chat Component

```bash
npm start
```

1. Click floating chat button (bottom-right)
2. Try example queries:
   - "Laptop gaming dưới 30 triệu"
   - "So sánh RTX 4060 và RTX 4070"
   - "Build PC gaming 40 triệu"
3. Verify:
   - Products display correctly
   - Markdown formatting works
   - Session persists on reload
   - Loading animation shows

### Debug Issues

**Chat doesn't open:**
```javascript
// Check console for errors
console.log('Chat open:', isChatOpen);
```

**API errors:**
```javascript
// Check network tab in DevTools
// Verify backend is running on port 5000
```

**Products not showing:**
```javascript
// Add debug logs in component
console.log('Products received:', data.products);
```

## Performance Tips

### Lazy Load Chat

```javascript
import { lazy, Suspense } from 'react';

const AICommerceChat = lazy(() => import('./components/AICommerceChat'));

function App() {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      <FloatingChatButton />
    </Suspense>
  );
}
```

### Optimize Re-renders

```javascript
import { memo } from 'react';

const ProductCard = memo(({ product }) => {
  // Component code
});
```

### Cache API Responses

```javascript
const cacheKey = `chat_${sessionId}`;
const cached = sessionStorage.getItem(cacheKey);

if (cached) {
  setMessages(JSON.parse(cached));
}
```

---

**Questions?** See `SETUP_GUIDE.md` for backend setup.
