import {
  ApprovalMode,
  AuthType,
  ContentGeneratorConfig,
  Config as CoreConfig,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_MODEL,
  GeminiClient,
  GeminiEventType,
  loadServerHierarchicalMemory,
  ServerGeminiContentEvent,
  ServerGeminiToolCallRequestEvent,
  ToolRegistry
} from '@google/gemini-cli-core';
import { Content, FunctionDeclaration } from '@google/genai';
import { randomUUID } from 'node:crypto';

// Tool usage data structures
export interface ToolRequestData {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolStartData {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultData {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  result: string;
  duration: number;
  success: boolean;
}

export interface ToolErrorData {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  error: string;
  duration: number;
}

export type EngineConfig = {
  dir: string;
  fullContext?: boolean;
  model?: 'pro' | 'flash' | 'mini';
  apikey?: string;
  sessionId?: string;
  debug: boolean;
}


class EngineService {
  private client: GeminiClient;
  private config: CoreConfig;
  private apikey: string;
  private sessionId: string;
  private debug: boolean;

  private toolRegistry?: ToolRegistry;
  private initialized = false;
  private memoryContent: string = '';

  constructor(config: EngineConfig) {
    const { dir, fullContext, model, apikey, sessionId, debug } = config;

    if (debug) {
      console.log(`⚙️ Configuring EngineService at ${dir}`);
    }

    if (!apikey) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
      }
      this.apikey = process.env.GEMINI_API_KEY;
      if (debug) {
        console.log(`⚙️ GEMINI_API_KEY set to ${this.apikey.substring(0, 6)}***`);
      }
    } else {
      this.apikey = apikey;
    }

    if (!sessionId || !sessionId.trim()) {
      this.sessionId = randomUUID().toString();
      if (debug) {
        console.log(`⚙️ No session ID provided, generating new one: ${sessionId}`);
      }
    } else {
      this.sessionId = sessionId;
    }

    this.config = new CoreConfig({
      targetDir: dir,
      approvalMode: ApprovalMode.DEFAULT,
      debugMode: debug,
      fullContext,
      sessionId: this.sessionId,
      cwd: dir,
      model: model === 'pro' ? DEFAULT_GEMINI_MODEL : (model === 'mini' ? "gemini-1.5-flash" : DEFAULT_GEMINI_FLASH_MODEL)
    })

    this.client = new GeminiClient(this.config);

    this.debug = debug;

    if (debug) {
      console.log(`⚙️ Configured engine with Session ID: ${this.sessionId}`);
    }
  }

  async getHistory(): Promise<Content[]> {
    await this.ensureInitialized();
    return this.client.getHistory();
  }

  async setHistory(history: Content[]): Promise<void> {
    await this.ensureInitialized();
    await this.client.setHistory(history);
  }

  async clearHistory(): Promise<void> {
    await this.ensureInitialized();
    await this.client.resetChat();
  }

  async *stream(
    message: string,
    context?: string,
  ): AsyncGenerator<string, void, unknown> {
    if (this.debug) {
      console.log('💬 Starting stream for message:', message.substring(0, 50) + '...');
    }
    
    await this.ensureInitialized();

    const fullMessage = context ? `${message}\n\nAdditional Context: ${context}` : message;

    const abortController = new AbortController();
    
    try {
      const stream = this.client.sendMessageStream(
        [{ text: fullMessage }],
        abortController.signal,
      );

      for await (const event of stream) {
        if (event.type === GeminiEventType.Content) {
          const contentEvent = event as ServerGeminiContentEvent;
          const token = contentEvent.value || '';
          yield token;
        } else if (event.type === GeminiEventType.ToolCallRequest) {
          const toolCallEvent = event as ServerGeminiToolCallRequestEvent;
          if (this.debug) {
            console.log(`🕒 Tool call requested: ${toolCallEvent.value.name}`);
          }
        } else if (event.type === GeminiEventType.ChatCompressed) {
          if (this.debug) {
            console.log('📦 Chat history was compressed');
          }
        }
      }
    } catch (error) {
      console.error('❌ Chat stream failed:', error);
      throw new Error(`Chat stream failed: ${error}`);
    }
  }

  async *streamWithToolEvents(
    message: string,
    context?: string,
  ): AsyncGenerator<{ type: 'text' | 'tool_request' | 'tool_start' | 'tool_result' | 'tool_error' | 'chat_compressed'; data: string | ToolRequestData | ToolStartData | ToolResultData | ToolErrorData | unknown }, void, unknown> {
    if (this.debug) {
      console.log('💬 Starting stream with tool events for message:', message.substring(0, 50) + '...');
    }
    
    await this.ensureInitialized();

    const fullMessage = context ? `${message}\n\nAdditional Context: ${context}` : message;

    const abortController = new AbortController();
    
    try {
      const stream = this.client.sendMessageStream(
        [{ text: fullMessage }],
        abortController.signal,
      );

      for await (const event of stream) {
        if (event.type === GeminiEventType.Content) {
          const contentEvent = event as ServerGeminiContentEvent;
          const token = contentEvent.value || '';
          yield { type: 'text', data: token };
        } else if (event.type === GeminiEventType.ToolCallRequest) {
          const toolCallEvent = event as ServerGeminiToolCallRequestEvent;
          yield {
            type: 'tool_request',
            data: {
              callId: toolCallEvent.value.callId,
              name: toolCallEvent.value.name,
              args: toolCallEvent.value.args
            }
          };
          if (this.debug) {
            console.log(`🕒 Tool call requested: ${toolCallEvent.value.name}`);
          }
        } else if (event.type === GeminiEventType.ChatCompressed) {
          yield { type: 'chat_compressed', data: event.value };
          if (this.debug) {
            console.log('📦 Chat history was compressed');
          }
        }
      }
    } catch (error) {
      console.error('❌ Chat stream failed:', error);
      throw new Error(`Chat stream failed: ${error}`);
    }
  }

  async getTools(): Promise<FunctionDeclaration[]> {
    await this.ensureInitialized();
    if (!this.toolRegistry) {
      throw new Error('Tool registry not initialized');
    }
    return this.toolRegistry.getFunctionDeclarations();
  }

  async executeTool(toolName: string, params: Record<string, unknown>) {
    await this.ensureInitialized();
    if (!this.toolRegistry) {
      throw new Error('Tool registry not initialized');
    }
    
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const abortController = new AbortController();
    return await tool.execute(params, abortController.signal);
  }

  getMemoryContent(): string {
    return this.memoryContent;
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      if (this.debug) {
        console.log(`🔧 Initializing engine with Session ID: ${this.sessionId}`);
      }
      
      const contentGeneratorConfig: ContentGeneratorConfig = {
        authType: AuthType.USE_GEMINI,
        model: DEFAULT_GEMINI_MODEL,
        apiKey: this.apikey,
      };

      try {
        await this.config.refreshAuth(AuthType.USE_GEMINI);
        
        await this.client.initialize(contentGeneratorConfig);
        if (this.debug) {
          console.log('🔧 Gemini client initialized');
        }

        this.toolRegistry = await this.config.getToolRegistry();
        
        const fileService = await this.config.getFileService();
        const { memoryContent, fileCount } = await loadServerHierarchicalMemory(
          this.config.getWorkingDir(), 
          this.config.getDebugMode(),
          fileService,
          this.config.getExtensionContextFilePaths(),
        );
        this.memoryContent = memoryContent;
        if (this.debug) {
          console.log(`🔧 Loaded ${fileCount} context files (${memoryContent.length} chars)`);
        }
        
        this.initialized = true;

        if (this.debug) {
          console.log('🔧 Engine initialization complete');
        }
      } catch (error) {
        if (this.debug) {
          console.error('❌ Engine initialization failed:', error);
        }
        throw error;
      }
    }
  }
}

const createEngine = (config: EngineConfig) => new EngineService(config)

export { createEngine, EngineService };
