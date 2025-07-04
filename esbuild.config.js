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
    entryPoints: ['src/engine/index.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    platform: 'node',
    format: 'esm',
    external: [
      'express',
      'cors',
      'routing-controllers',
      'reflect-metadata',
      '@google/gemini-cli-core',
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

// Build TypeScript declarations
esbuild
  .build({
    entryPoints: ['src/engine/index.ts'],
    bundle: true,
    outfile: 'dist/index.d.ts',
    platform: 'node',
    format: 'esm',
    external: [
      'express',
      'cors',
      'routing-controllers',
      'reflect-metadata',
      '@google/gemini-cli-core',
      '@google/genai',
      '@koa/cors',
      '@koa/router',
      'koa',
      'koa-bodyparser',
      'koa-compose'
    ],
    write: false,
  })
  .then((result) => {
    // Extract type declarations from the bundle
    const typeContent = result.outputFiles?.[0]?.text || '';
    const fs = require('fs');
    fs.writeFileSync('dist/index.d.ts', typeContent);
    console.log('✅ TypeScript declarations built successfully');
  })
  .catch(() => {
    console.error('❌ TypeScript declarations build failed');
    process.exit(1);
  });

// Build test file
esbuild
  .build({
    entryPoints: ['src/engine/test.ts'],
    bundle: true,
    outfile: 'dist/test.js',
    platform: 'node',
    format: 'esm',
    external: [
      'express',
      'cors',
      'routing-controllers',
      'reflect-metadata',
      '@google/gemini-cli-core',
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
