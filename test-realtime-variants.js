#!/usr/bin/env node

/**
 * Comprehensive test for OpenAI Realtime API
 * Tests different model names and configurations
 */

const WebSocket = require('ws');
const fs = require('fs');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in .env');
  process.exit(1);
}

const MODELS = [
  'gpt-realtime',
  'gpt-4o-realtime-preview-2024-12-17',
  'gpt-4o-realtime',
];

const CONFIGS = {
  minimal: (instructions) => ({
    modalities: ['text', 'audio'],
    instructions,
    voice: 'shimmer'
  }),

  withTurnDetection: (instructions) => ({
    modalities: ['text', 'audio'],
    instructions,
    voice: 'shimmer',
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 1200,
      create_response: true
    }
  }),

  withTranscription: (instructions) => ({
    modalities: ['text', 'audio'],
    instructions,
    voice: 'shimmer',
    input_audio_transcription: {
      model: 'whisper-1'
    },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 1200,
      create_response: true
    }
  }),

  structuredAudio: (instructions) => ({
    type: 'realtime',
    output_modalities: ['audio'],
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1200,
          create_response: true
        },
        transcription: { model: 'whisper-1' }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: 'shimmer'
      }
    },
    instructions
  })
};

const INSTRUCTIONS = {
  short: 'You are a helpful assistant.',
  ukrainian: 'Ти Марія, віртуальна викладачка.',
  full: 'Ти Марія, віртуальна викладачка. Привіт! Я твій віртуальний викладач і віртуальний друг з теми впровадження штучного інтелекту в школах.'
};

const results = [];

function testConfiguration(model, configName, instructionsName, config) {
  return new Promise((resolve) => {
    const url = `wss://api.openai.com/v1/realtime?model=${model}`;
    console.log(`\n🧪 Testing: ${model} + ${configName} + ${instructionsName}`);

    const ws = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    const result = {
      model,
      configName,
      instructionsName,
      success: false,
      sessionCreated: false,
      sessionUpdated: false,
      error: null,
      timestamp: new Date().toISOString()
    };

    const timeout = setTimeout(() => {
      result.error = 'Timeout (10s)';
      ws.close();
      resolve(result);
    }, 10000);

    ws.on('open', () => {
      const sessionUpdate = {
        type: 'session.update',
        session: config
      };
      ws.send(JSON.stringify(sessionUpdate));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'session.created') {
          result.sessionCreated = true;
          console.log('  ✅ session.created');
        }

        if (msg.type === 'session.updated') {
          result.sessionUpdated = true;
          result.success = true;
          console.log('  ✅ session.updated');
          clearTimeout(timeout);
          ws.close();
          resolve(result);
        }

        if (msg.type === 'error') {
          result.error = msg.error?.message || 'Unknown error';
          console.log(`  ❌ error: ${result.error}`);
          clearTimeout(timeout);
          ws.close();
          resolve(result);
        }
      } catch (err) {
        result.error = `Parse error: ${err.message}`;
        clearTimeout(timeout);
        ws.close();
        resolve(result);
      }
    });

    ws.on('error', (err) => {
      result.error = `WebSocket error: ${err.message}`;
      clearTimeout(timeout);
      resolve(result);
    });

    ws.on('close', () => {
      if (!result.success && !result.error) {
        result.error = 'Connection closed without success';
      }
      clearTimeout(timeout);
      resolve(result);
    });
  });
}

async function runTests() {
  console.log('🚀 Starting comprehensive OpenAI Realtime API tests...\n');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🔑 API Key: ${OPENAI_API_KEY.substring(0, 20)}...`);
  console.log(`\n${'='.repeat(80)}\n`);

  // Test each combination
  for (const model of MODELS) {
    for (const [configName, configFn] of Object.entries(CONFIGS)) {
      for (const [instructionsName, instructions] of Object.entries(INSTRUCTIONS)) {
        const config = configFn(instructions);
        const result = await testConfiguration(model, configName, instructionsName, config);
        results.push(result);

        // Wait between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);
  console.log('📊 RESULTS SUMMARY\n');

  // Group by success
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}\n`);

  if (successful.length > 0) {
    console.log('✅ WORKING CONFIGURATIONS:\n');
    successful.forEach(r => {
      console.log(`  ✓ ${r.model} + ${r.configName} + ${r.instructionsName}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ FAILED CONFIGURATIONS:\n');
    failed.forEach(r => {
      console.log(`  ✗ ${r.model} + ${r.configName} + ${r.instructionsName}`);
      console.log(`    Error: ${r.error}`);
    });
  }

  // Save detailed results to JSON
  const reportPath = 'test-realtime-results.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to: ${reportPath}`);

  // Recommend best configuration
  if (successful.length > 0) {
    console.log('\n🎯 RECOMMENDED CONFIGURATION:\n');
    const best = successful[0];
    console.log(`  Model: ${best.model}`);
    console.log(`  Config: ${best.configName}`);
    console.log(`  Instructions: ${best.instructionsName}`);
    console.log('\n  Use this in your application for guaranteed success! ✨');
  } else {
    console.log('\n⚠️  No working configurations found!');
    console.log('   Check your API key and OpenAI account access to Realtime API.');
  }

  console.log(`\n${'='.repeat(80)}\n`);
}

runTests().catch(console.error);
