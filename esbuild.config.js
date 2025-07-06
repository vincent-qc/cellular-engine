import { execSync } from 'child_process';
import esbuild from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, 'package.json'));

// Build the main bundle
esbuild
  .build({
    entryPoints: ['packages/engine/index.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    platform: 'node',
    format: 'esm',
    external: [
      'express',
      'cors',
      'routing-controllers',
      'reflect-metadata',
      '@google/genai',
      '@koa/cors',
      '@koa/router',
      'koa',
      'koa-bodyparser',
      'koa-compose'
    ],
    define: {
      'process.env.API_VERSION': JSON.stringify(pkg.version),
    },
    banner: {
      js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url); globalThis.__filename = require('url').fileURLToPath(import.meta.url); globalThis.__dirname = require('path').dirname(globalThis.__filename);`,
    },
  })
  .then(() => {
    console.log('✅ Main bundle built successfully');
  })
  .catch(() => {
    console.error('❌ Main bundle build failed');
    process.exit(1);
  });

// Generate TypeScript declarations using tsc
try {
  execSync('npx tsc packages/engine/index.ts --declaration --emitDeclarationOnly --outDir dist --moduleResolution node --target es2022 --module esnext --allowSyntheticDefaultImports --esModuleInterop --skipLibCheck', { stdio: 'inherit' });
  console.log('✅ TypeScript declarations built successfully');
} catch (_error) {
  console.error('❌ TypeScript declarations build failed');
  process.exit(1);
}

// Build test file
esbuild
  .build({
    entryPoints: ['packages/engine/test.ts'],
    bundle: true,
    outfile: 'dist/test.js',
    platform: 'node',
    format: 'esm',
    external: [
      'express',
      'cors',
      'routing-controllers',
      'reflect-metadata',
      '@google/genai',
      '@koa/cors',
      '@koa/router',
      'koa',
      'koa-bodyparser',
      'koa-compose'
    ],
  })
  .then(() => {
    console.log('✅ Test file built successfully');
  })
  .catch(() => {
    console.error('❌ Test file build failed');
    process.exit(1);
  });
