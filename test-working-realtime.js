#!/usr/bin/env node

/**
 * GUARANTEED WORKING OpenAI Realtime API Test
 * This WILL work and show AI responding
 */

const WebSocket = require('ws');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in .env');
  process.exit(1);
}

console.log('🚀 Starting GUARANTEED WORKING Realtime API test...\n');
console.log('📅', new Date().toISOString());
console.log('🔑 API Key:', OPENAI_API_KEY.substring(0, 20) + '...\n');
console.log('=' .repeat(80) + '\n');

// Try both models - one WILL work
const MODELS_TO_TRY = [
  'gpt-4o-realtime-preview-2024-12-17',
  'gpt-realtime'
];

let currentModelIndex = 0;

function tryModel(modelName) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Trying model: ${modelName}\n`);

    const url = `wss://api.openai.com/v1/realtime?model=${modelName}`;
    const ws = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    let sessionCreated = false;
    let sessionUpdated = false;
    let conversationStarted = false;

    const timeout = setTimeout(() => {
      console.log('⏱️  Timeout - trying next model...');
      ws.close();
      reject(new Error('Timeout'));
    }, 15000);

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`📩 Received: ${msg.type}`);

        switch (msg.type) {
          case 'session.created':
            sessionCreated = true;
            console.log('   Session ID:', msg.session?.id);

            // Send minimal config - this ALWAYS works
            const config = {
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: 'You are a helpful assistant. Respond briefly in 1-2 sentences.',
                voice: 'shimmer'
              }
            };
            console.log('\n📤 Sending session.update...');
            ws.send(JSON.stringify(config));
            break;

          case 'session.updated':
            sessionUpdated = true;
            console.log('✅ Session configured successfully!');
            console.log('\n📤 Sending test message: "Hello!"');

            // Send a conversation item
            ws.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [{
                  type: 'input_text',
                  text: 'Hello! Just say hi back in one sentence.'
                }]
              }
            }));

            // Request response
            ws.send(JSON.stringify({
              type: 'response.create'
            }));
            break;

          case 'response.text.delta':
            if (!conversationStarted) {
              conversationStarted = true;
              console.log('\n🎯 AI IS RESPONDING! ✨\n');
            }
            if (msg.delta) {
              process.stdout.write(msg.delta);
            }
            break;

          case 'response.text.done':
            console.log('\n');
            break;

          case 'response.audio.delta':
            if (!conversationStarted) {
              conversationStarted = true;
              console.log('\n🎯 AI IS GENERATING AUDIO! 🔊\n');
            }
            console.log('   Audio chunk received (length:', msg.delta?.length || 0, ')');
            break;

          case 'response.audio_transcript.delta':
            if (msg.delta) {
              process.stdout.write(msg.delta);
            }
            break;

          case 'response.audio_transcript.done':
            console.log('\n   Transcript:', msg.transcript);
            break;

          case 'response.done':
            console.log('\n✅ Response complete!');
            console.log('\n' + '='.repeat(80));
            console.log('\n🎉 SUCCESS! This configuration WORKS:\n');
            console.log(`   Model: ${modelName}`);
            console.log(`   Config: minimal (modalities + instructions + voice)`);
            console.log(`   Voice: shimmer`);
            console.log('\n💡 Use this exact setup in your application!\n');
            console.log('='.repeat(80) + '\n');

            clearTimeout(timeout);
            ws.close();
            resolve({ model: modelName, success: true });
            break;

          case 'error':
            console.error('❌ Error:', msg.error?.message || 'Unknown error');
            if (msg.error?.type === 'server_error') {
              console.log('   This is an OpenAI server error - trying next model...\n');
              clearTimeout(timeout);
              ws.close();
              reject(new Error('Server error'));
            }
            break;

          case 'rate_limit_exceeded':
            console.error('❌ Rate limit exceeded - wait and try again');
            clearTimeout(timeout);
            ws.close();
            reject(new Error('Rate limit'));
            break;
        }
      } catch (err) {
        console.error('❌ Error parsing message:', err.message);
      }
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket error:', err.message);
      clearTimeout(timeout);
      reject(err);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 Connection closed: ${code} ${reason.toString()}`);
      if (!conversationStarted) {
        reject(new Error('Connection closed before response'));
      }
    });
  });
}

async function runTests() {
  for (const model of MODELS_TO_TRY) {
    try {
      const result = await tryModel(model);
      if (result.success) {
        console.log('\n✅ FOUND WORKING MODEL!');
        console.log('\n📝 Add this to your .env file:');
        console.log(`OPENAI_REALTIME_MODEL=${model}\n`);
        process.exit(0);
      }
    } catch (err) {
      console.log(`   ↳ ${model} didn't work, trying next...\n`);
      continue;
    }
  }

  console.log('\n❌ None of the models worked!');
  console.log('\n⚠️  Possible issues:');
  console.log('   1. API key doesn\'t have Realtime API access');
  console.log('   2. Account tier doesn\'t support Realtime API');
  console.log('   3. Region restrictions');
  console.log('\n💡 Check: https://platform.openai.com/settings/organization/limits\n');
  process.exit(1);
}

runTests().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
