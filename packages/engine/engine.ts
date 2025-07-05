import {
  ApprovalMode,
  AuthType,
  ContentGeneratorConfig,
  Config as CoreConfig,
  DEFAULT_GEMINI_MODEL,
  executeToolCall,
  GeminiClient,
  GeminiEventType,
  loadServerHierarchicalMemory,
  ServerGeminiContentEvent,
  ServerGeminiToolCallRequestEvent,
  ToolCallRequestInfo,
  ToolRegistry,
} from '@google/gemini-cli-core';
import { FunctionDeclaration, Part } from '@google/genai';
import { randomUUID } from 'node:crypto';


class EngineService {
  private client: GeminiClient;
  private config: CoreConfig;
  private apikey: string;
  private sessionId: string;
  private debug: boolean;

  private toolRegistry?: ToolRegistry;
  private initialized = false;
  private memoryContent: string = '';

  constructor(dir: string, fullContext: boolean,  apikey: string, debug: boolean, sessionId?: string) {
    if (debug) {
      console.log(`⚙️ Configuring EngineService at ${dir}`);
    }

    if (!apikey) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
      }
      this.apikey = process.env.GEMINI_API_KEY;
      if (debug) {
        console.log(`⚙️ GEMINI_API_KEY set to ${apikey.substring(0, 6)}***`);
      }
    } else {
      this.apikey = apikey;
    }

    if (!sessionId || !sessionId.trim()) {
      sessionId = randomUUID().toString();
      if (debug) {
        console.log(`⚙️ No session ID provided, generating new one: ${sessionId}`);
      }
    }

    this.config = new CoreConfig({
      targetDir: dir,
      approvalMode: ApprovalMode.DEFAULT,
      debugMode: debug,
      fullContext,
      sessionId,
      cwd: dir,
      model: DEFAULT_GEMINI_MODEL
    })

    this.client = new GeminiClient(this.config);
    this.sessionId = sessionId;
    this.debug = debug;

    if (debug) {
      console.log(`⚙️ Configured engine with Session ID: ${this.sessionId}`);
    }
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
    let currentMessages: Part[] = [{ text: fullMessage }];

    try {
      while (true) {
        const stream = this.client.sendMessageStream(
          currentMessages,
          abortController.signal,
        );

        const toolCallRequests: ToolCallRequestInfo[] = [];

        for await (const event of stream) {
          if (event.type === GeminiEventType.Content) {
            const contentEvent = event as ServerGeminiContentEvent;
            const token = contentEvent.value || '';
            yield token;
          } else if (event.type === GeminiEventType.ToolCallRequest) {
            const toolCallEvent = event as ServerGeminiToolCallRequestEvent;
            toolCallRequests.push(toolCallEvent.value);
            if (this.debug) {
              console.log(`🕒 Tool call requested: ${toolCallEvent.value.name}`);
            }
          }
        }

        // If there are tool calls, execute them and continue the conversation
        if (toolCallRequests.length > 0) {
          const toolResponseParts: Part[] = [];

          for (const toolCallRequest of toolCallRequests) {
            try {
              const toolResponse = await executeToolCall(
                this.config,
                toolCallRequest,
                this.toolRegistry!,
                abortController.signal,
              );

              if (toolResponse.error) {
                console.error(
                  `❌ Error executing tool ${toolCallRequest.name}: ${toolResponse.resultDisplay || toolResponse.error.message}`,
                );
                yield `\n\nError executing tool ${toolCallRequest.name}: ${toolResponse.resultDisplay || toolResponse.error.message}\n\n`;
                return;
              }

              if (toolResponse.responseParts) {
                const parts = Array.isArray(toolResponse.responseParts)
                  ? toolResponse.responseParts
                  : [toolResponse.responseParts];
                
                for (const part of parts) {
                  if (typeof part === 'string') {
                    toolResponseParts.push({ text: part });
                  } else if (part) {
                    toolResponseParts.push(part);
                  }
                }
              }

            } catch (error) {
              console.error(`❌ Tool execution failed:`, error);
              yield `\n\nTool execution failed: ${error}\n\n`;
              return;
            }
          }
          currentMessages = toolResponseParts;
        } else {
          break;
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
        await this.client.initialize(contentGeneratorConfig);
        if (this.debug) {
          console.log('🔧 Gemini client initialized');
        }
        
        this.toolRegistry = await this.config.getToolRegistry();
        if (this.debug) {
          console.log('🔧 Tool registry ready');
        }
        
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

const createEngine = (dir: string, fullContext: boolean = false, apikey: string, debug: boolean = false, sessionId?: string) => new EngineService(dir, fullContext, apikey, debug, sessionId)

export { createEngine, EngineService };
