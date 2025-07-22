/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { CoreToolScheduler, convertToFunctionResponse, } from './coreToolScheduler.js';
import { BaseTool, ToolConfirmationOutcome, } from '../index.js';
class MockTool extends BaseTool {
    shouldConfirm = false;
    executeFn = vi.fn();
    constructor(name = 'mockTool') {
        super(name, name, 'A mock tool', {});
    }
    async shouldConfirmExecute(_params, _abortSignal) {
        if (this.shouldConfirm) {
            return {
                type: 'exec',
                title: 'Confirm Mock Tool',
                command: 'do_thing',
                rootCommand: 'do_thing',
                onConfirm: async () => { },
            };
        }
        return false;
    }
    async execute(params, _abortSignal) {
        this.executeFn(params);
        return { llmContent: 'Tool executed', returnDisplay: 'Tool executed' };
    }
}
describe('CoreToolScheduler', () => {
    it('should cancel a tool call if the signal is aborted before confirmation', async () => {
        const mockTool = new MockTool();
        mockTool.shouldConfirm = true;
        const toolRegistry = {
            getTool: () => mockTool,
            getFunctionDeclarations: () => [],
            tools: new Map(),
            discovery: {},
            registerTool: () => { },
            getToolByName: () => mockTool,
            getToolByDisplayName: () => mockTool,
            getTools: () => [],
            discoverTools: async () => { },
            getAllTools: () => [],
            getToolsByServer: () => [],
        };
        const onAllToolCallsComplete = vi.fn();
        const onToolCallsUpdate = vi.fn();
        const mockConfig = {
            getSessionId: () => 'test-session-id',
            getUsageStatisticsEnabled: () => true,
            getDebugMode: () => false,
        };
        const scheduler = new CoreToolScheduler({
            config: mockConfig,
            toolRegistry: Promise.resolve(toolRegistry),
            onAllToolCallsComplete,
            onToolCallsUpdate,
            getPreferredEditor: () => 'vscode',
        });
        const abortController = new AbortController();
        const request = {
            callId: '1',
            name: 'mockTool',
            args: {},
            isClientInitiated: false,
        };
        abortController.abort();
        await scheduler.schedule([request], abortController.signal);
        const _waitingCall = onToolCallsUpdate.mock
            .calls[1][0][0];
        const confirmationDetails = await mockTool.shouldConfirmExecute({}, abortController.signal);
        if (confirmationDetails) {
            await scheduler.handleConfirmationResponse('1', confirmationDetails.onConfirm, ToolConfirmationOutcome.ProceedOnce, abortController.signal);
        }
        expect(onAllToolCallsComplete).toHaveBeenCalled();
        const completedCalls = onAllToolCallsComplete.mock
            .calls[0][0];
        expect(completedCalls[0].status).toBe('cancelled');
    });
});
describe('convertToFunctionResponse', () => {
    const toolName = 'testTool';
    const callId = 'call1';
    it('should handle simple string llmContent', () => {
        const llmContent = 'Simple text output';
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual({
            functionResponse: {
                name: toolName,
                id: callId,
                response: { output: 'Simple text output' },
            },
        });
    });
    it('should handle llmContent as a single Part with text', () => {
        const llmContent = { text: 'Text from Part object' };
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual({
            functionResponse: {
                name: toolName,
                id: callId,
                response: { output: 'Text from Part object' },
            },
        });
    });
    it('should handle llmContent as a PartListUnion array with a single text Part', () => {
        const llmContent = [{ text: 'Text from array' }];
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual({
            functionResponse: {
                name: toolName,
                id: callId,
                response: { output: 'Text from array' },
            },
        });
    });
    it('should handle llmContent with inlineData', () => {
        const llmContent = {
            inlineData: { mimeType: 'image/png', data: 'base64...' },
        };
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual([
            {
                functionResponse: {
                    name: toolName,
                    id: callId,
                    response: {
                        output: 'Binary content of type image/png was processed.',
                    },
                },
            },
            llmContent,
        ]);
    });
    it('should handle llmContent with fileData', () => {
        const llmContent = {
            fileData: { mimeType: 'application/pdf', fileUri: 'gs://...' },
        };
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual([
            {
                functionResponse: {
                    name: toolName,
                    id: callId,
                    response: {
                        output: 'Binary content of type application/pdf was processed.',
                    },
                },
            },
            llmContent,
        ]);
    });
    it('should handle llmContent as an array of multiple Parts (text and inlineData)', () => {
        const llmContent = [
            { text: 'Some textual description' },
            { inlineData: { mimeType: 'image/jpeg', data: 'base64data...' } },
            { text: 'Another text part' },
        ];
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual([
            {
                functionResponse: {
                    name: toolName,
                    id: callId,
                    response: { output: 'Tool execution succeeded.' },
                },
            },
            ...llmContent,
        ]);
    });
    it('should handle llmContent as an array with a single inlineData Part', () => {
        const llmContent = [
            { inlineData: { mimeType: 'image/gif', data: 'gifdata...' } },
        ];
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual([
            {
                functionResponse: {
                    name: toolName,
                    id: callId,
                    response: {
                        output: 'Binary content of type image/gif was processed.',
                    },
                },
            },
            ...llmContent,
        ]);
    });
    it('should handle llmContent as a generic Part (not text, inlineData, or fileData)', () => {
        const llmContent = { functionCall: { name: 'test', args: {} } };
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual({
            functionResponse: {
                name: toolName,
                id: callId,
                response: { output: 'Tool execution succeeded.' },
            },
        });
    });
    it('should handle empty string llmContent', () => {
        const llmContent = '';
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual({
            functionResponse: {
                name: toolName,
                id: callId,
                response: { output: '' },
            },
        });
    });
    it('should handle llmContent as an empty array', () => {
        const llmContent = [];
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual([
            {
                functionResponse: {
                    name: toolName,
                    id: callId,
                    response: { output: 'Tool execution succeeded.' },
                },
            },
        ]);
    });
    it('should handle llmContent as a Part with undefined inlineData/fileData/text', () => {
        const llmContent = {}; // An empty part object
        const result = convertToFunctionResponse(toolName, callId, llmContent);
        expect(result).toEqual({
            functionResponse: {
                name: toolName,
                id: callId,
                response: { output: 'Tool execution succeeded.' },
            },
        });
    });
});
//# sourceMappingURL=coreToolScheduler.test.js.map