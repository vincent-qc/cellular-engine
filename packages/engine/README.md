# Gemini CLI Engine API

This package provides a streaming API for the Gemini CLI backend that includes both content tokens and tool usage metadata.

## Streaming API

The `stream()` function in `api.ts` provides a Server-Sent Events (SSE) streaming interface that sends both model content and tool usage information in real-time.

### Event Format

Each event is sent as a JSON object with the following structure:

```json
{
  "type": "content" | "tool_request" | "tool_start" | "tool_result" | "tool_error",
  "data": string | ToolRequestData | ToolStartData | ToolResultData | ToolErrorData,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Event Types

#### 1. Content Events (`type: "content"`)
- **Purpose**: Regular text tokens from the Gemini model
- **Data**: `string` - The text token
- **When**: Streamed continuously as the model generates content

#### 2. Tool Request Events (`type: "tool_request"`)
- **Purpose**: Notifies when the model requests to use a tool
- **Data**: `ToolRequestData`
- **When**: Immediately when the model decides to use a tool

```typescript
interface ToolRequestData {
  callId: string;        // Unique identifier for this tool call
  name: string;          // Name of the tool being called
  args: Record<string, unknown>; // Arguments passed to the tool
}
```

#### 3. Tool Start Events (`type: "tool_start"`)
- **Purpose**: Notifies when tool execution begins
- **Data**: `ToolStartData`
- **When**: Right before tool execution starts

```typescript
interface ToolStartData {
  callId: string;        // Same callId as the request
  name: string;          // Tool name
  args: Record<string, unknown>; // Tool arguments
}
```

#### 4. Tool Result Events (`type: "tool_result"`)
- **Purpose**: Notifies when tool execution completes successfully
- **Data**: `ToolResultData`
- **When**: After successful tool execution

```typescript
interface ToolResultData {
  callId: string;        // Same callId as the request
  name: string;          // Tool name
  args: Record<string, unknown>; // Tool arguments
  result: string;        // Tool execution result (user-friendly display)
  duration: number;      // Execution time in milliseconds
  success: boolean;      // Always true for this event type
}
```

#### 5. Tool Error Events (`type: "tool_error"`)
- **Purpose**: Notifies when tool execution fails
- **Data**: `ToolErrorData`
- **When**: After failed tool execution

```typescript
interface ToolErrorData {
  callId: string;        // Same callId as the request
  name: string;          // Tool name
  args: Record<string, unknown>; // Tool arguments
  error: string;         // Error message
  duration: number;      // Execution time in milliseconds
}
```

## Frontend Implementation

### Basic EventSource Implementation

```javascript
const eventSource = new EventSource('/api/stream');

eventSource.onmessage = function(event) {
  const streamEvent = JSON.parse(event.data);
  
  switch (streamEvent.type) {
    case 'content':
      // Append text token to UI
      appendToChat(streamEvent.data);
      break;
      
    case 'tool_request':
      // Show tool request indicator
      showToolRequest(streamEvent.data);
      break;
      
    case 'tool_start':
      // Show tool execution indicator
      showToolExecution(streamEvent.data);
      break;
      
    case 'tool_result':
      // Show tool result
      showToolResult(streamEvent.data);
      break;
      
    case 'tool_error':
      // Show tool error
      showToolError(streamEvent.data);
      break;
  }
};

eventSource.onerror = function(error) {
  console.error('EventSource failed:', error);
  eventSource.close();
};
```

### React Implementation Example

```jsx
import { useState, useEffect } from 'react';

function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [currentTool, setCurrentTool] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource('/api/stream');
    
    eventSource.onmessage = (event) => {
      const streamEvent = JSON.parse(event.data);
      
      switch (streamEvent.type) {
        case 'content':
          setMessages(prev => [...prev, { type: 'content', text: streamEvent.data }]);
          break;
          
        case 'tool_request':
          setCurrentTool({
            callId: streamEvent.data.callId,
            name: streamEvent.data.name,
            args: streamEvent.data.args,
            status: 'requested'
          });
          break;
          
        case 'tool_start':
          setCurrentTool(prev => prev?.callId === streamEvent.data.callId ? {
            ...prev,
            status: 'executing'
          } : prev);
          break;
          
        case 'tool_result':
          setMessages(prev => [...prev, {
            type: 'tool_result',
            tool: streamEvent.data.name,
            result: streamEvent.data.result,
            duration: streamEvent.data.duration
          }]);
          setCurrentTool(null);
          break;
          
        case 'tool_error':
          setMessages(prev => [...prev, {
            type: 'tool_error',
            tool: streamEvent.data.name,
            error: streamEvent.data.error,
            duration: streamEvent.data.duration
          }]);
          setCurrentTool(null);
          break;
      }
    };

    return () => eventSource.close();
  }, []);

  return (
    <div>
      {messages.map((msg, index) => (
        <div key={index}>
          {msg.type === 'content' && <span>{msg.text}</span>}
          {msg.type === 'tool_result' && (
            <div className="tool-result">
              <strong>{msg.tool}</strong> completed in {msg.duration}ms
              <pre>{msg.result}</pre>
            </div>
          )}
          {msg.type === 'tool_error' && (
            <div className="tool-error">
              <strong>{msg.tool}</strong> failed after {msg.duration}ms
              <pre>{msg.error}</pre>
            </div>
          )}
        </div>
      ))}
      
      {currentTool && (
        <div className="tool-status">
          {currentTool.status === 'requested' && `Requesting ${currentTool.name}...`}
          {currentTool.status === 'executing' && `Executing ${currentTool.name}...`}
        </div>
      )}
    </div>
  );
}
```

### Advanced State Management

For more complex applications, consider using a state management library:

```javascript
// Redux slice example
const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    messages: [],
    activeTools: new Map(),
    toolHistory: []
  },
  reducers: {
    addContent: (state, action) => {
      state.messages.push({ type: 'content', text: action.payload });
    },
    addToolRequest: (state, action) => {
      const { callId, name, args } = action.payload;
      state.activeTools.set(callId, { name, args, status: 'requested' });
    },
    updateToolStatus: (state, action) => {
      const { callId, status } = action.payload;
      const tool = state.activeTools.get(callId);
      if (tool) {
        tool.status = status;
      }
    },
    addToolResult: (state, action) => {
      const { callId, ...result } = action.payload;
      state.toolHistory.push(result);
      state.activeTools.delete(callId);
    }
  }
});
```

## Error Handling

### Network Errors
```javascript
eventSource.onerror = function(error) {
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log('Connection closed');
  } else if (eventSource.readyState === EventSource.CONNECTING) {
    console.log('Attempting to reconnect...');
  }
};
```

### Parsing Errors
```javascript
eventSource.onmessage = function(event) {
  try {
    const streamEvent = JSON.parse(event.data);
    // Process event...
  } catch (error) {
    console.error('Failed to parse event:', error);
    // Handle gracefully - maybe show a generic error message
  }
};
```

### Tool Execution Errors
Tool errors are automatically handled by the streaming API and sent as `tool_error` events. The frontend should display these appropriately:

```javascript
case 'tool_error':
  showNotification({
    type: 'error',
    title: `Tool ${streamEvent.data.name} failed`,
    message: streamEvent.data.error,
    duration: streamEvent.data.duration
  });
  break;
```

## Performance Considerations

1. **Event Buffering**: Consider buffering content events to reduce UI updates
2. **Tool Status Updates**: Use debouncing for tool status updates to avoid excessive re-renders
3. **Memory Management**: Clean up completed tool states to prevent memory leaks
4. **Connection Management**: Implement reconnection logic for production use

## Testing

### Mock EventSource for Testing
```javascript
// Mock implementation for testing
class MockEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = EventSource.CONNECTING;
    setTimeout(() => {
      this.readyState = EventSource.OPEN;
      this.onopen?.();
    }, 0);
  }
  
  close() {
    this.readyState = EventSource.CLOSED;
  }
  
  // Simulate receiving events
  simulateEvent(type, data) {
    this.onmessage?.({
      data: JSON.stringify({ type, data, timestamp: new Date().toISOString() })
    });
  }
}

// Usage in tests
global.EventSource = MockEventSource;
```

This streaming API provides comprehensive tool usage tracking while maintaining backward compatibility with existing content streaming functionality. 