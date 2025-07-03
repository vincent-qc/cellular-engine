/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FunctionDeclaration } from '@google/genai';
import { Response } from 'express';
import { Body, Controller, Get, Param, Post, Res } from 'routing-controllers';
import { EngineService } from '../utils/gemini.js';

interface StreamBody {
  prompt: string;
  context?: string;
}

interface ToolExecuteBody {
  toolName: string;
  params: Record<string, unknown>;
}

@Controller('/chat')
export class ChatController {
  private engine: EngineService;

  constructor() {
    this.engine = new EngineService(process.env.GEMINI_API_KEY!, "/Users/vincentqi/Developer/GitHub/cf");
  }

  @Get('/test')
  async test() {
    try {
      console.log('🧪 Testing API key and engine...');
      const apiKey = process.env.GEMINI_API_KEY;
      console.log('API Key present:', !!apiKey);
      
      const tools = await this.engine.getTools();
      console.log('Tools available:', tools.length);
      
      return { 
        status: 'ok', 
        apiKeyPresent: !!apiKey,
        toolsCount: tools.length,
        tools: tools.map((t: FunctionDeclaration) => t.name)
      };
    } catch (error) {
      console.error('❌ Test failed:', error);
      return { 
        status: 'error', 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  @Post('/stream')
  async stream(@Body() body: StreamBody, @Res() response: Response) {
    console.log('📨 Received chat request:', { prompt: body.prompt, context: body.context });
    
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');

    try {
      console.log('🔄 Starting stream...');
      let tokenCount = 0;
      
      for await (const token of this.engine.stream(body.prompt, body.context)) {
        response.write(token);
        tokenCount++;
        if (tokenCount % 10 === 0) {
          console.log(`📤 Sent ${tokenCount} tokens`);
        }
      }
      
      console.log(`✅ Stream completed. Total tokens: ${tokenCount}`);
      response.end();
      return response;
    } catch (error) {
      console.error('❌ Stream error:', error);
      
      // Check if headers were already sent
      if (response.headersSent) {
        console.error('Headers already sent, cannot send error response');
        return response;
      }
      
      response.status(500).json({
        error: 'Streaming failed',
        details: error instanceof Error ? error.message : String(error),
      });
      return response;
    }
  }

  @Get('/tools')
  async getTools() {
    try {
      const tools = await this.engine.getTools();
      return { tools };
    } catch (error) {
      throw new Error(`Failed to get tools: ${error}`);
    }
  }

  @Post('/tools/:toolName/execute')
  async executeTool(
    @Param('toolName') toolName: string,
    @Body() body: ToolExecuteBody,
  ) {
    try {
      const result = await this.engine.executeTool(toolName, body.params);
      return { result };
    } catch (error) {
      throw new Error(`Failed to execute tool ${toolName}: ${error}`);
    }
  }
}
