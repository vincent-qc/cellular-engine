/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  ContentGeneratorConfig,
  DEFAULT_GEMINI_MODEL,
  GeminiClient,
  GeminiEventType,
  ServerGeminiContentEvent,
  ServerGeminiToolCallRequestEvent,
  ToolCallRequestInfo,
  ToolRegistry,
  executeToolCall,
  loadServerHierarchicalMemory,
} from '@google/gemini-cli-core';
import { FunctionDeclaration, Part } from '@google/genai';
import { APIConfig } from './config.js';

export class EngineService {
  private client: GeminiClient;
  private config: APIConfig;
  private toolRegistry?: ToolRegistry;
  private initialized = false;
  private memoryContent: string = '';

  constructor(apiKey: string, workingDir: string) {
    console.log('🔧 Initializing EngineService...');
    console.log('Working directory:', workingDir);
    console.log('API key present:', !!apiKey);
    
    this.config = new APIConfig(apiKey, workingDir);
    this.client = new GeminiClient(this.config);
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      console.log('🔄 Initializing engine...');
      
      const contentGeneratorConfig: ContentGeneratorConfig = {
        authType: AuthType.USE_GEMINI,
        model: DEFAULT_GEMINI_MODEL,
        apiKey: this.config.getApiKey(),
      };

      try {
        console.log('📡 Initializing Gemini client...');
        await this.client.initialize(contentGeneratorConfig);
        console.log('✅ Gemini client initialized');
        
        console.log('🔧 Getting tool registry...');
        this.toolRegistry = await this.config.getToolRegistry();
        console.log('✅ Tool registry ready');
        
        console.log('🧠 Loading hierarchical memory context...');
        const fileService = this.config.getFileDiscoveryService();
        const { memoryContent, fileCount } = await loadServerHierarchicalMemory(
          this.config.getWorkingDir(),
          this.config.getDebugMode(),
          fileService,
          this.config.getExtensionContextFilePaths(),
        );
        this.memoryContent = memoryContent;
        console.log(`✅ Loaded ${fileCount} context files (${memoryContent.length} chars)`);
        
        this.initialized = true;
        console.log('✅ Engine initialization complete');
      } catch (error) {
        console.error('❌ Engine initialization failed:', error);
        throw error;
      }
    }
  }

  // Stream AI responses with tool execution support
  async *stream(
    message: string,
    context?: string,
  ): AsyncGenerator<string, void, unknown> {
    console.log('💬 Starting stream for message:', message.substring(0, 50) + '...');
    
    await this.ensureInitialized();

    // Use the hierarchical memory context instead of simple concatenation
    const fullMessage = context ? `${message}\n\nAdditional Context: ${context}` : message;
    console.log('📝 Full message length:', fullMessage.length);

    const abortController = new AbortController();
    let currentMessages: Part[] = [{ text: fullMessage }];

    try {
      while (true) {
        console.log('🔄 Calling sendMessageStream...');
        const stream = this.client.sendMessageStream(
          currentMessages,
          abortController.signal,
        );

        let eventCount = 0;
        const toolCallRequests: ToolCallRequestInfo[] = [];

        for await (const event of stream) {
          eventCount++;
          
          if (event.type === GeminiEventType.Content) {
            const contentEvent = event as ServerGeminiContentEvent;
            const token = contentEvent.value || '';
            yield token;
            
            if (eventCount % 5 === 0) {
              console.log(`📤 Processed ${eventCount} events`);
            }
          } else if (event.type === GeminiEventType.ToolCallRequest) {
            const toolCallEvent = event as ServerGeminiToolCallRequestEvent;
            toolCallRequests.push(toolCallEvent.value);
            console.log(`🔧 Tool call requested: ${toolCallEvent.value.name}`);
          }
        }

        console.log(`✅ Stream completed. Total events: ${eventCount}`);

        // If there are tool calls, execute them and continue the conversation
        if (toolCallRequests.length > 0) {
          console.log(`🛠️ Executing ${toolCallRequests.length} tool calls...`);
          
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
                return; // Exit on tool error
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

              console.log(`✅ Tool ${toolCallRequest.name} executed successfully`);
            } catch (error) {
              console.error(`❌ Tool execution failed:`, error);
              yield `\n\nTool execution failed: ${error}\n\n`;
              return; // Exit on tool error
            }
          }

          // Continue the conversation with tool responses
          currentMessages = toolResponseParts;
          console.log('🔄 Continuing conversation with tool responses...');
        } else {
          // No more tool calls, conversation is complete
          console.log('✅ Conversation complete');
          break;
        }
      }
    } catch (error) {
      console.error('❌ Chat stream failed:', error);
      throw new Error(`Chat stream failed: ${error}`);
    }
  }

  // Get available tools
  async getTools(): Promise<FunctionDeclaration[]> {
    await this.ensureInitialized();
    if (!this.toolRegistry) {
      throw new Error('Tool registry not initialized');
    }
    return this.toolRegistry.getFunctionDeclarations();
  }

  // Execute a specific tool
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

  // Get memory content for debugging
  getMemoryContent(): string {
    return this.memoryContent;
  }
}
