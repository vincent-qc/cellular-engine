/* eslint-env node */
import { createEngine } from '../dist/index.js';

async function testEngine() {
  try {
    console.log('🧪 Testing engine initialization...');
    
    // Set API key for testing
    process.env.GEMINI_API_KEY = 'test-key';
    
    const engine = createEngine('/tmp', false, true);
    
    console.log('✅ Engine created successfully');
    
    // Test getting tools
    try {
      const tools = await engine.getTools();
      console.log(`✅ Got ${tools.length} tools successfully`);
    } catch (error) {
      console.log('❌ Error getting tools:', error.message);
    }
    
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEngine(); 