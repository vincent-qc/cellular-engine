/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EngineService } from './utils/gemini.js';

async function testAPI() {
  console.log('🧪 Testing Gemini CLI API...');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  const engine = new EngineService(process.env.GEMINI_API_KEY, process.cwd());

  try {
    // Test getting tools
    console.log('📋 Testing getTools...');
    const tools = await engine.getTools();
    console.log(`✅ Found ${tools.length} tools`);

    // Test streaming chat
    console.log('💬 Testing chat stream...');
    let responseCount = 0;
    for await (const token of engine.stream('Hello! Can you help me with coding?')) {
      process.stdout.write(token);
      responseCount++;
      if (responseCount > 100) break; // Limit for testing
    }
    console.log('\n✅ Chat stream test completed');

    // Test file listing
    console.log('📁 Testing file listing...');
    const _lsResult = await engine.executeTool('ls', { path: '.' });
    console.log('✅ File listing test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }

  console.log('🎉 All tests passed!');
}

testAPI(); 