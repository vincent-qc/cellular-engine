/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EngineService } from './utils/gemini.js';

async function debugEngine() {
  console.log('🔍 Debugging Engine Service...');
  
  const apiKey = process.env.GEMINI_API_KEY || 'test-key';
  console.log('API Key:', apiKey ? 'Set' : 'Not set');
  
  const engine = new EngineService(apiKey, process.cwd());
  
  try {
    console.log('📋 Testing getTools...');
    const tools = await engine.getTools();
    console.log(`✅ Found ${tools.length} tools`);
    console.log('Tool names:', tools.map(t => t.name).join(', '));
    
    // Test if ls tool exists
    const lsTool = tools.find(t => t.name === 'ls');
    if (lsTool) {
      console.log('✅ ls tool found!');
    } else {
      console.log('❌ ls tool not found');
    }
  } catch (error) {
    console.error('❌ getTools failed:', error);
  }
  
  try {
    console.log('💬 Testing stream...');
    let count = 0;
    for await (const token of engine.stream('Hello')) {
      process.stdout.write(token);
      count++;
      if (count > 10) break;
    }
    console.log('\n✅ Stream test completed');
  } catch (error) {
    console.error('❌ Stream failed:', error);
  }
}

debugEngine(); 