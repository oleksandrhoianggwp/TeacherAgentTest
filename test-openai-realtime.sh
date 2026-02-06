#!/bin/bash
# Test OpenAI Realtime API access

# Read API key from .env
source .env

echo "Testing OpenAI Realtime API..."
echo "Model: gpt-realtime (stable version, Jan 2026)"
echo ""

# Create WebSocket connection test
node -e "
const WebSocket = require('ws');

const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-realtime', {
  headers: {
    'Authorization': 'Bearer ${OPENAI_API_KEY}',
    'OpenAI-Beta': 'realtime=v1'
  }
});

ws.on('open', () => {
  console.log('✅ WebSocket connected');

  const config = {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: 'You are a helpful assistant.',
      voice: 'shimmer'
    }
  };

  console.log('Sending session.update...');
  ws.send(JSON.stringify(config));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📩 Received:', msg.type);

  if (msg.type === 'error') {
    console.error('❌ Error:', msg.error);
    process.exit(1);
  }

  if (msg.type === 'session.updated') {
    console.log('✅ Session configured successfully!');
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Timeout - no response from OpenAI');
  ws.close();
  process.exit(1);
}, 10000);
"
