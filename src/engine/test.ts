import { engine, stream } from './index';

console.log('🧪 Testing @cellular/engine exports...');

// Test that engine function exists
if (typeof engine === 'function') {
  console.log('✅ engine function exported correctly');
} else {
  console.error('❌ engine function not exported correctly');
  process.exit(1);
}

// Test that stream function exists
if (typeof stream === 'function') {
  console.log('✅ stream function exported correctly');
} else {
  console.error('❌ stream function not exported correctly');
  process.exit(1);
}

console.log('✅ All exports working correctly!'); 