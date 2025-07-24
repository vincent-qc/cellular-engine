import { Response } from 'express';
import { EngineService, ToolErrorData, ToolRequestData, ToolResultData, ToolStartData } from "../services/engine.js";

export interface StreamEvent {
  type: 'text' | 'tool_request' | 'tool_start' | 'tool_result' | 'tool_error';
  content: string | ToolRequestData | ToolStartData | ToolResultData | ToolErrorData;
  timestamp: string;
}

const stream = async (response: Response, engine: EngineService, prompt: string, setHeaders?: boolean, context?: string) => {
  if (setHeaders) {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
  }

  const sendEvent = (event: StreamEvent) => {
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    for await (const event of engine.streamWithToolEvents(prompt, context)) {
      sendEvent({
        type: event.type,
        content: event.data,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    // Send error event
    sendEvent({
      type: 'tool_error',
      content: {
        callId: 'error',
        name: 'unknown',
        args: {},
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      },
      timestamp: new Date().toISOString()
    });
  } finally {
    response.end();
  }
}

export { stream };
