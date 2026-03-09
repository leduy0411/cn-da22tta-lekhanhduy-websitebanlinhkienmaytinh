import React, { useState } from 'react';
import axios from 'axios';

const ChatBox = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Xin chao! Toi la tro ly RAG. Ban hay hoi ve linh kien may tinh hoac san pham trong cua hang.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const nextMessages = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('/api/chat', { message });
      const answer = response.data?.answer || 'Xin loi, toi chua tao duoc cau tra loi.';
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Khong the ket noi chatbot luc nay.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>RAG Hardware Assistant</div>

      <div style={styles.history}>
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            style={{
              ...styles.bubble,
              ...(message.role === 'user' ? styles.userBubble : styles.assistantBubble)
            }}
          >
            {message.content}
          </div>
        ))}
        {loading && <div style={{ ...styles.bubble, ...styles.assistantBubble }}>Dang tra loi...</div>}
      </div>

      <form onSubmit={sendMessage} style={styles.form}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Hoi ve CPU, GPU, RAM, laptop..."
          style={styles.input}
          disabled={loading}
        />
        <button type="submit" style={styles.button} disabled={loading || !input.trim()}>
          Gui
        </button>
      </form>
    </div>
  );
};

const styles = {
  wrapper: {
    width: '100%',
    maxWidth: 420,
    margin: '0 auto',
    border: '1px solid #dbe3ea',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    height: 560,
    background: '#ffffff'
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #e5edf5',
    fontWeight: 700,
    color: '#16324f'
  },
  history: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: '#f7fafc'
  },
  bubble: {
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 14,
    lineHeight: 1.5,
    maxWidth: '90%',
    whiteSpace: 'pre-wrap'
  },
  userBubble: {
    alignSelf: 'flex-end',
    background: '#d7ecff',
    color: '#0c2840'
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    background: '#ffffff',
    border: '1px solid #d9e4ef',
    color: '#1d344a'
  },
  form: {
    borderTop: '1px solid #e5edf5',
    display: 'flex',
    gap: 8,
    padding: 10
  },
  input: {
    flex: 1,
    border: '1px solid #c7d7e7',
    borderRadius: 8,
    padding: '10px 12px',
    outline: 'none'
  },
  button: {
    border: 'none',
    borderRadius: 8,
    padding: '10px 14px',
    background: '#1976d2',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer'
  }
};

export default ChatBox;
