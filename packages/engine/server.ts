import express from 'express';
import { stream } from './api/stream.js';
import { createEngine, EngineConfig, EngineService } from './services/engine.js';

const port = process.env.PORT || 5000;

const app = express();
app.use(express.json());

let engine: EngineService | null = null;

app.post('/create', (req, res) => {
  engine = createEngine(req.body as EngineConfig);
  res.end();
});

app.post('/stream', (req, res) => {
  if (!engine) return res.status(400).send('Engine not initialized');
  stream(res, engine, req.body.prompt, true, req.body.context);
});

app.listen(port, () => console.log(`Server running on port ${port}`)); 