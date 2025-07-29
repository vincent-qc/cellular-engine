import { ChildProcess, spawn } from "child_process";
import { Response } from 'express';
import getPort from "get-port";
import { Socket } from "socket.io";
import { EngineConfig } from "./engine.js";

class DockerEngineService {
  private port: number = 0;
  private config: EngineConfig;
  private dockerProcess: ChildProcess | null= null;
  private containerId: string = "";

  constructor(config: EngineConfig) {
    this.config = config;
  }

  async init(memory: string = '256m', cpus: string = '1') {
    this.port = await getPort({ port: 5000 });
    
    // Check if the pre-built image exists
    await this.ensureImageExists();
    
    const dockerArgs = [
      'run',
      '-d',
      '-p', `${this.port}:5000`,
      '-v', `${this.config.dir}:/project`,
      '-e', `PORT=5000`,
      '-e', `GEMINI_API_KEY=${process.env.GEMINI_API_KEY}`,
      '--memory', memory,
      '--cpus', cpus,
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
          this.containerId = containerId.trim();
          this.healthCheck()
            .then(() => resolve(this.containerId))
            .catch(reject);
        } else {
          reject(new Error(`Docker container failed to start with code: ${code}`));
        }
      });
      
      this.dockerProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async create() {
    try {
      const containerConfig = {
        ...this.config,
        dir: '/project'
      };
      
      const response = await fetch(`http://localhost:${this.port}/docker/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerConfig)
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

  async streamSSE(response: Response, prompt: string, setHeaders?: boolean) {
    if (setHeaders) {
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
    }

    try {
      const stream = await fetch(`http://localhost:${this.port}/docker/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!stream.ok) {
        throw new Error(`Stream request failed: ${stream.status} ${stream.statusText}`);
      }

      const reader = stream.body?.getReader();
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

  async streamSocket(socket: Socket, prompt: string) {
    try {
      const stream = await fetch(`http://localhost:${this.port}/docker/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!stream.ok) {
        throw new Error(`Stream request failed: ${stream.status} ${stream.statusText}`);
      }

      const reader = stream.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Reader not found");

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // First decode UINT8 array into string
          const decoded = decoder.decode(value, { stream: true });
          if (this.config.debug) console.log("-- Decoded Chunk --: \n", decoded, "\n -- Decoded End --");

          // Handle multiline SSE
          const lines = decoded.split('\n');
          for (const line of lines) {

            // Check for formatting & parse
            if (!line.startsWith('data: ')) throw new Error("SSE not formatted correctly.");
            const data = JSON.parse(line.slice('data: '.length));
            socket.emit('stream-data', data);
          }
        }
      } finally {
        socket.emit('stream-end');
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Stream error:', error);
      socket.emit('stream-error', { error });
    }
  }

  async kill() {
    if (this.containerId) {
      const stopProcess = spawn('docker', ['stop', this.containerId]);
      stopProcess.on('close', (code) => {
        if (code !== 0) {
          console.warn(`Failed to stop Docker container ${this.containerId}`);
        } else {
          if (this.config.debug) console.log(`Docker Container with id ${this.containerId} stopped.`);
        }
      })
    }
    this.dockerProcess?.kill();
  }


  private async healthCheck(maxRetries: number = 30, retryInterval: number = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fetch(`http://localhost:${this.port}/docker/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000) // 5 second timeout per request
        });
        if (this.config.debug) console.log('Server is ready!');
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(`Server failed to become ready after ${maxRetries} attempts: ${error}`);
        }
        if (this.config.debug) console.warn(`Waiting for server... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }
  }

  private async ensureImageExists(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkProcess = spawn('docker', ['images', '-q', 'gemini-engine-server'], {
        stdio: 'pipe'
      });

      let imageExists = false;
      checkProcess.stdout?.on('data', (data) => {
        if (data.toString().trim()) {
          imageExists = true;
        }
      });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          if (imageExists) {
            resolve();
          } else {
            reject(new Error('Docker image "gemini-engine-server" not found. Please build it first with: npm run docker:build'));
          }
        } else {
          reject(new Error('Failed to check for Docker image'));
        }
      });

      checkProcess.on('error', (error) => {
        reject(error);
      });
    });
  }
}

const dockerEngine = (config: EngineConfig) => new DockerEngineService(config);
export { dockerEngine, DockerEngineService };
