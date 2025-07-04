<div align='center'>
  <h1>@cellular-ai/engine</h1>
  <p>API for building agentic coding editors/platforms</p>
</div>

<br>

<div align='center'>
	<img
	    src="https://img.shields.io/github/license/vincent-qc/cellular-engine?style=for-the-badge"
	    alt="License"
	/>
	<img
		src='https://img.shields.io/github/languages/top/vincent-qc/cellular-engine.svg?style=for-the-badge'
		alt='Language'
	/>
  <img
		src='https://img.shields.io/badge/version-1.18.2-red?style=for-the-badge'
		alt='MC Version'
	/>
</div>

## Features

- **AI-powered code generation** with streaming support
- **Tool execution** with automatic function calling
- **Memory management** for context-aware conversations
- **Express.js integration** for easy web server setup
- **TypeScript support** with full type definitions

## Installation

```bash
npm install @cellular-ai/engine
```

## Quick Start

### Basic Usage

```typescript
import { engine, stream } from '@cellular-ai/engine';

// Create an engine instance
const engineInstance = engine('./my-project', true, 'session-123', 'your-api-key');

// Stream AI responses
for await (const token of engineInstance.stream('Write a function to sort an array')) {
  process.stdout.write(token);
}
```

### Express.js Integration

```typescript
import express from 'express';
import { stream } from '@cellular-ai/engine';

const app = express();
const engineInstance = engine('./my-project', true, 'session-123', 'your-api-key');

app.post('/generate', async (req, res) => {
  const { prompt, context } = req.body;
  
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  await stream(res, engineInstance, prompt, context);
  return res;
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## API Reference

### `engine(dir, fullContext?, sessionId?, apikey?, debug?)`

Creates a new engine instance.

**Parameters:**
- `dir` (string): Project directory path
- `fullContext` (boolean, optional): Whether to include full context. Default: `false`
- `sessionId` (string, optional): Session identifier. Auto-generated if not provided
- `apikey` (string, optional): Gemini API key. Can also be set via `GEMINI_API_KEY` environment variable
- `debug` (boolean, optional): Enable debug logging. Default: `false`

**Returns:** `EngineService` instance

### `stream(response, engine, prompt, context?)`

Streams AI responses to an Express.js response object.

**Parameters:**
- `response` (Response): Express.js response object
- `engine` (EngineService): Engine instance
- `prompt` (string): User prompt
- `context` (string, optional): Additional context

### EngineService Methods

#### `stream(message, context?)`

Streams AI responses as an async generator.

```typescript
for await (const token of engineInstance.stream('Your prompt here')) {
  console.log(token);
}
```

#### `getTools()`

Returns available tools as function declarations.

```typescript
const tools = await engineInstance.getTools();
console.log('Available tools:', tools.map(t => t.name));
```

#### `executeTool(toolName, params)`

Executes a specific tool with parameters.

```typescript
const result = await engineInstance.executeTool('read-file', { path: './example.js' });
console.log(result);
```

#### `getMemoryContent()`

Returns the current memory content.

```typescript
const memory = engineInstance.getMemoryContent();
console.log('Memory content:', memory);
```

## Configuration

### Environment Variables

- `GEMINI_API_KEY`: Your Gemini API key (required)

## Examples

### Code Generation

```typescript
import { engine } from '@cellular-ai/engine';

const engineInstance = engine('./my-project', true, 'code-gen-session');

for await (const token of engineInstance.stream(
  'Create a React component that displays a user profile'
)) {
  process.stdout.write(token);
}
```

### Tool Execution

```typescript
import { engine } from '@cellular-ai/engine';

const engineInstance = engine('./my-project');

// Get available tools
const tools = await engineInstance.getTools();
console.log('Available tools:', tools.map(t => t.name));

// Execute a specific tool
const fileContent = await engineInstance.executeTool('read-file', {
  path: './src/index.js'
});
console.log('File content:', fileContent);
```

## License
All code in this project is maintained under the [Apache-2.0 License](./LICENSE)

