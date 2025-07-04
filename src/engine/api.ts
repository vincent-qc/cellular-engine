import { Response } from 'express';
import { EngineService } from "./engine";

const stream = async (response: Response, engine: EngineService, prompt: string, context?: string) => {
  for await (const token of engine.stream(prompt, context)) {
    response.write(token);
  }
  response.end();
}

export { stream };
