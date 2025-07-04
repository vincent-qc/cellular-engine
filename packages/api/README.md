# @cellular/gemini-api

Express middleware for Gemini CLI core functionality.

## Installation

```bash
npm install @cellular/gemini-api
```

## Usage

```javascript
import express from 'express';
import gemini from '@cellular/gemini-api';

const app = express();

// Mount all Gemini API routes
app.use(gemini());

// Or hide specific routes
app.use(gemini({ 
  hide: ['/files'] // This will hide all /files/* routes
}));

// Custom CORS configuration
app.use(gemini({ 
  cors: { origin: 'https://yourdomain.com' }
}));

// Custom route prefix
app.use(gemini({ 
  routePrefix: '/gemini-api'
}));

app.listen(3000);
```

## Configuration

The `gemini(config)` function accepts the following configuration:

- `hide?: string[]` - Array of route prefixes to hide (e.g., `['/chat', '/files']`)
- `cors?: CorsOptions` - CORS configuration (defaults to `{ origin: 'http://localhost:3000' }`)
- `routePrefix?: string` - Route prefix for all API endpoints (defaults to `/api`)

## Available Routes

- `/api/chat/*` - Chat and streaming endpoints
- `/api/files/*` - File system operations

## License

Apache-2.0 