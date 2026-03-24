const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const CHAT_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function sendMessage(message, sessionId = null) {
  const payload = {
    message,
    sessionId,
  };

  const response = await axios.post(CHAT_ENDPOINT, payload, {
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

(async () => {
  try {
    console.log('Running unified flow regression test...');

    const greeting = await sendMessage('xin chao');
    assert(greeting && greeting.success === true, 'Greeting request failed');
    assert(typeof greeting?.data?.text === 'string' && greeting.data.text.trim().length > 0, 'Greeting text is empty');
    assert(Array.isArray(greeting?.data?.products), 'Greeting payload missing products array');

    const technical = await sendMessage('ban huong dan toi sua laptop duoc khong', greeting.sessionId || null);
    assert(technical && technical.success === true, 'Technical request failed');
    assert(typeof technical?.data?.text === 'string' && technical.data.text.trim().length > 0, 'Technical text is empty');
    assert(Array.isArray(technical?.data?.products), 'Technical payload missing products array');

    const gText = (greeting.data.text || '').trim().toLowerCase();
    const tText = (technical.data.text || '').trim().toLowerCase();
    assert(gText !== tText, 'Technical response unexpectedly equals greeting response');

    console.log('PASS: unified flow is active and responses are valid (Groq or fallback).');
    console.log(JSON.stringify({
      greeting: greeting.data.text,
      technical: technical.data.text,
      providerGreeting: greeting?.data?.meta?.provider || 'unknown_or_fallback',
      providerTechnical: technical?.data?.meta?.provider || 'unknown_or_fallback',
    }, null, 2));
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
})();
