import cors from 'cors';
import express, { RequestHandler } from 'express';
import 'reflect-metadata';
import { useExpressServer } from 'routing-controllers';
import { ChatController } from './routes/chat.js';
import { FilesController } from './routes/files.js';

export interface GeminiConfig {
  hide?: string[]; // Array of route prefixes to hide, e.g. ['/chat', '/files']
  cors?: Parameters<typeof cors>[0];
  routePrefix?: string;
  // ...other config options as needed
}

/**
 * Returns an Express middleware that mounts the Gemini API routes.
 * @param config GeminiConfig
 */
export function gemini(config: GeminiConfig = {}): RequestHandler {
  // Create a new router instance
  const router = express.Router();

  // CORS support
  router.use(cors(config.cors || { origin: 'http://localhost:3000' }));
  router.use(express.json());

  // Determine which controllers to expose
  const allControllers = [
    { controller: ChatController, prefix: '/chat' },
    { controller: FilesController, prefix: '/files' },
  ];
  const hidden = new Set((config.hide || []).map((h) => h.replace(/^\/api/, '')));
  const controllers = allControllers
    .filter(({ prefix }) => !hidden.has(prefix))
    .map(({ controller }) => controller);

  // Mount the selected controllers using routing-controllers
  useExpressServer(router, {
    controllers,
    routePrefix: config.routePrefix || '/api',
    defaultErrorHandler: false,
  });

  // Error handling middleware
  router.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Gemini API Error:', error);
    if (res.headersSent) return next(error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Something went wrong',
    });
  });

  return router;
}

export default gemini; 