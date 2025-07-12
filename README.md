<div align='center'>
  <h1>@cellular-ai/engine</h1>
  <p>API for building agentic coding editors/platforms |
   <a href="https://www.npmjs.com/package/@cellular-ai/engine">NPM</p></p>
</div>

<br>

<div align='center'>
	<img
	    src="https://img.shields.io/github/license/vincent-qc/cellular-engine?style=for-the-badge"
	    alt="License"
	/>
  <img
		src='https://img.shields.io/npm/d18m/%40cellular-ai%2Fengine?style=for-the-badge'
		alt='NPM Downloads'
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
const engineInstance = engine({
  dir: './my-project',
  fullContext: true,
  sessionId: 'session-123',
  apikey: 'your-api-key',
  debug: false
});

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
const engineInstance = engine({
  dir: './my-project',
  fullContext: true,
  sessionId: 'session-123',
  apikey: 'your-api-key',
  debug: false
});

app.post('/generate', async (req, res) => {
  const { prompt, context } = req.body;
  const setHeaders = true;
  
  // Stream agent response w/ tool calls for given prompt
  await stream(res, engineInstance, prompt, setHeaders, context);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

The stream function returns data in standard SSE format:
- Content events: `data: {"type": "text", "content": "hello world", "timestamp": "..."}`
- Tool events: 
  ```
  event: tool_request
  data: {"type": "tool_request", "content": {...}, "timestamp": "..."}
  ```

## API Reference

### `engine(config)`

Creates a new engine instance.

**Parameters:**
- `config` (EngineConfig): Configuration object with the following properties:
  - `dir` (string): Project directory path
  - `fullContext` (boolean, optional): Whether to dump entire codebase into context window. Default: `false`
  - `model` (string, optional): Model to use. Options: `'pro'`, `'flash'`, `'mini'`. Default: `'flash'`
  - `apikey` (string, optional): Gemini API key. Can also be set via `GEMINI_API_KEY` environment variable.
  - `sessionId` (string, optional): Session identifier. Auto-generated if not provided.
  - `debug` (boolean): Enable debug logging

**Returns:** `EngineService` instance

### `stream(response, engine, prompt, setHeaders?, context?)`

Express Integration to Streams AI responses seamlessly.

**Parameters:**
- `response` (Response): Express.js response object.
- `engine` (EngineService): Engine instance.
- `prompt` (string): User prompt.
- `setHeaders` (boolean, optional): Whether to set required SSE headers automatically. Default: `false`
- `context` (string, optional): Additional context.

### EngineService Methods

#### `stream(message, context?)`

Streams AI responses as an async generator. Ideal for ask type questions that do not require tool usage.

```typescript
for await (const token of engineInstance.stream('Your prompt here')) {
  console.log(token);
}
```

#### `streamWithToolEvents(message, context?)`

Streams AI responses with tool execution events as an async generator. Ideal for project-wide agent queries.

```typescript
for await (const event of engineInstance.streamWithToolEvents('Your prompt here')) {
  if (event.type === 'text') {
    console.log(event.data);
  } else if (event.type === 'tool_request') {
    console.log('Tool requested:', event.data);
  }
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

const engineInstance = engine({
  dir: './my-project',
  fullContext: true,
  sessionId: 'code-gen-session',
  debug: false
});

for await (const token of engineInstance.stream(
  'Create a React component that displays a user profile'
)) {
  process.stdout.write(token);
}
```

### Streaming with Tool Events

```typescript
import { engine } from '@cellular-ai/engine';

const engineInstance = engine({
  dir: './my-project',
  fullContext: true,
  sessionId: 'code-gen-session',
  debug: false
});

for await (const event of engineInstance.streamWithToolEvents(
  'Create a React component that displays a user profile'
)) {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.data);
      break;
    case 'tool_request':
      console.log('🛠️ Tool requested:', event.data.name);
      break;
    case 'tool_start':
      console.log('🚀 Tool started:', event.data.name);
      break;
    case 'tool_result':
      console.log('✅ Tool completed:', event.data.name);
      break;
    case 'tool_error':
      console.log('❌ Tool failed:', event.data.name);
      break;
  }
}
```

### Tool Execution

```typescript
import { engine } from '@cellular-ai/engine';

const engineInstance = engine({
  dir: './my-project',
  debug: false
});

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

