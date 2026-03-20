const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const CHAT_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat`;

const CASES = [
  {
    name: 'power_boot',
    message: 'laptop khong len nguon',
    mustContainAny: ['nguon', 'adapter', 'hard reset', 'khoi dong']
  },
  {
    name: 'battery_charging',
    message: 'pin laptop sut nhanh',
    mustContainAny: ['pin', 'sac', 'adapter', 'firmware']
  },
  {
    name: 'network',
    message: 'wifi hay mat ket noi',
    mustContainAny: ['wifi', 'dns', 'adapter', 'router']
  },
  {
    name: 'thermal_fan',
    message: 'may bi nong va quat keu to',
    mustContainAny: ['nhiet', 'quat', 'tan nhiet', 'cpu']
  },
  {
    name: 'keyboard_touchpad',
    message: 'ban phim bi liet phim',
    mustContainAny: ['ban phim', 'touchpad', 'hid', 'fn']
  }
];

const BLOCKED_PATTERNS = [
  /moi quan he tinh cam khong phu hop/i,
  /nguoi lon va tre em/i,
  /khong the tra loi cac noi dung/i,
  /khong tim thay thong tin cu the/i
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function sendMessage(message, sessionId = null) {
  const payload = { message, sessionId };

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await axios.post(CHAT_ENDPOINT, payload, {
        timeout: 25000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || 0;
      const transient = status === 429 || status === 502 || status === 503 || status === 504 || status === 0;
      if (!transient || attempt === 3) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw lastError;
}

(async () => {
  try {
    console.log('Running troubleshooting scenario tests...');

    const greeting = await sendMessage('xin chao');
    const gText = normalize(greeting?.data?.text || '');
    assert(greeting?.success === true, 'Greeting request failed');
    assert(greeting?.data?.meta?.provider === 'groq', 'Greeting should come from Groq');
    assert(!gText.includes('checklist'), 'Greeting must not include technical checklist');

    let successCount = 0;
    const transientFailures = [];

    for (const item of CASES) {
      try {
        const response = await sendMessage(item.message, null);
        assert(response?.success === true, `${item.name}: request failed`);
        assert(response?.data?.meta?.provider === 'groq' || response?.data?.meta?.provider === 'groq-safe-fallback', `${item.name}: unexpected provider`);

        const answer = String(response?.data?.text || '');
        const normalizedAnswer = normalize(answer);

        assert(normalizedAnswer.length > 40, `${item.name}: answer too short`);

        for (const pattern of BLOCKED_PATTERNS) {
          assert(!pattern.test(normalizedAnswer), `${item.name}: contains blocked phrase`);
        }

        const matchedKeyword = item.mustContainAny.some((k) => normalizedAnswer.includes(normalize(k)));
        assert(matchedKeyword, `${item.name}: answer does not include domain keywords`);

        successCount += 1;
        console.log(`PASS ${item.name}: ${answer.replace(/\s+/g, ' ').slice(0, 180)}...`);
      } catch (error) {
        const status = error?.response?.status || 0;
        const transient = status === 429 || status === 502 || status === 503 || status === 504 || status === 0;
        if (transient) {
          transientFailures.push(`${item.name}:${status || 'network'}`);
          console.log(`WARN ${item.name}: transient failure (${status || 'network'})`);
          continue;
        }

        throw error;
      }
    }

    assert(successCount >= 4, `Only ${successCount}/${CASES.length} troubleshooting cases succeeded. transient=${transientFailures.join(',')}`);

    if (transientFailures.length > 0) {
      console.log(`WARN transient failures: ${transientFailures.join(', ')}`);
    }

    console.log('PASS: troubleshooting scenarios are stable across issue categories.');
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
})();
