import { ChildProcess, spawn } from "child_process";
import { Response } from 'express';
import getPort from "get-port";
import { EngineConfig } from "./engine.js";

class DockerEngineService {
  private port: number = 0;
  private dockerProcess: ChildProcess | null= null;
  private config: EngineConfig;

  constructor(config: EngineConfig) {
    this.config = config;
  }

  async init() {
    this.port = await getPort({ port: 5000 });
    
    // Build the Docker image first
    await this.buildImage();
    
    const dockerArgs = [
      'run',
      '-d',
      '-p', `${this.port}:5000`,
      '-e', `PORT=5000`,
      '-e', `GEMINI_API_KEY=${process.env.GEMINI_API_KEY}`,
      'gemini-engine-server'
    ];

    return new Promise((resolve, reject) => {
      this.dockerProcess = spawn('docker', dockerArgs);
      
      // Capture the container ID
      let containerId = '';
      this.dockerProcess.stdout?.on('data', (data) => {
        containerId += data.toString();
      });
      
      this.dockerProcess.on('close', (code: number | null) => {
        if (code === 0) {
          console.log(`Docker container started with ID: ${containerId.trim()}`);
          // Wait a moment for the server to start
          setTimeout(() => resolve(containerId.trim()), 2000);
        } else {
          reject(new Error(`Docker container failed to start with code: ${code}`));
        }
      });
      
      this.dockerProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async buildImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('docker', [
        'build', 
        '-t', 'gemini-engine-server',
        '-f', 'packages/engine/Dockerfile',
        '.'
      ], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      buildProcess.on('close', (code: number | null) => {
        if (code === 0) {
          console.log('Docker image built successfully');
          resolve();
        } else {
          reject(new Error(`Docker build failed with code: ${code}`));
        }
      });

      buildProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async create() {
    try {
      const response = await fetch(`http://localhost:${this.port}/docker/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.config)
      });
      
      if (!response.ok) {
        throw new Error(`Create request failed: ${response.status} ${response.statusText}`);
      }
      
      console.log('Engine created successfully');
    } catch (error) {
      console.error('Failed to create engine:', error);
      throw error;
    }
  }

  async stream(response: Response, prompt: string, setHeaders?: boolean) {
    if (setHeaders) {
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
    }

    try {
      const streamResponse = await fetch(`http://localhost:${this.port}/docker/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!streamResponse.ok) {
        throw new Error(`Stream request failed: ${streamResponse.status} ${streamResponse.statusText}`);
      }

      const reader = streamResponse.body?.getReader();
      if (!reader) throw new Error('No response body');

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          response.write(value);
        }
      } finally {
        reader.releaseLock();
        response.end();
      }
    } catch (error) {
      console.error('Stream error:', error);
      response.status(500).json({ error: 'Stream failed' });
    }
  }

  async kill() {
    this.dockerProcess?.kill();
  }
}

const dockerEngine = (config: EngineConfig) => new DockerEngineService(config);
export { dockerEngine, DockerEngineService };
