import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import 'reflect-metadata';
import { useExpressServer } from 'routing-controllers';
import { ChatController } from './routes/chat.js';
import { FilesController } from './routes/files.js';

// Load environment variables from .env file
dotenv.config({ path: '../../.env' });

const PORT = process.env.PORT || 4000;
const app = express();

const corsConfig = {
  origin: 'http://localhost:3000',
};

// Middleware
app.use(express.json());
app.use(cors(corsConfig));

useExpressServer(app, {
  controllers: [ChatController, FilesController],
  routePrefix: '/api',
  defaultErrorHandler: false,
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: error.message || 'Something went wrong',
  });
});

app.listen(PORT, () => {
  console.log(`API Server listening on port ${PORT}`);
  console.log('Environment variables loaded:', {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Present' : 'Missing',
    PORT: process.env.PORT || 4000,
  });
});

export default app;
