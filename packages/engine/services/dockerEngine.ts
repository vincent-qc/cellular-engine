import { spawn } from "child_process";
import { Response } from 'express';
import getPort from "get-port";
import { EngineConfig } from "../engine.js";

class DockerEngineService {
  private port: number = 0;
  private dockerProcess: any = null;
  private config: EngineConfig;

  constructor(config: EngineConfig) {
    this.config = config;
  }

  async init() {
    this.port = await getPort({ port: 5000 });
    const dockerArgs = [
      'run',
      '-d',
      '-p', `${this.port}:${this.port}`,
      '-e', `PORT=${this.port}`,
      '-e', `GEMINI_API_KEY=${process.env.GEMINI_API_KEY}`
    ];

    return new Promise((resolve, reject) => {
      this.dockerProcess = spawn('docker', dockerArgs);
      this.dockerProcess.on('close', (code: number | null) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(code);
        }
      })
    })
  }

  async stream(response: Response, prompt: string, setHeaders?: boolean) {
    if (setHeaders) {
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
    }

    const streamResponse = await fetch(`http://localhost:${this.port}/sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const reader = streamResponse.body?.getReader();
    if (!reader) throw new Error('No response body');

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        response.write(value);
      }
    } finally {
      response.end();
    }
  }

  async kill() {
    this.dockerProcess?.kill();
  }
}

