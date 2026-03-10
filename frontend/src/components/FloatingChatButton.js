import React, { useState } from 'react';
import AICommerceChat from './AICommerceChat';
import './FloatingChatButton.css';

const FloatingChatButton = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (!isChatOpen) {
      setHasUnread(false);
    }
  };

  return (
    <>
      <button 
        className={`floating-chat-button ${isChatOpen ? 'active' : ''}`}
        onClick={handleToggleChat}
        aria-label="Open AI Chat Assistant"
      >
        {isChatOpen ? (
          <span className="close-icon">✕</span>
        ) : (
          <>
            <span className="chat-icon">🤖</span>
            {hasUnread && <span className="unread-badge"></span>}
          </>
        )}
      </button>

      <AICommerceChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
      />
    </>
  );
};

export default FloatingChatButton;
