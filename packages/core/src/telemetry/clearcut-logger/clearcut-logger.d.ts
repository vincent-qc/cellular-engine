/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import { Buffer } from 'buffer';
import { StartSessionEvent, EndSessionEvent, UserPromptEvent, ToolCallEvent, ApiRequestEvent, ApiResponseEvent, ApiErrorEvent } from '../types.js';
import { Config } from '../../config/config.js';
export interface LogResponse {
    nextRequestWaitMs?: number;
}
export declare class ClearcutLogger {
    private static instance;
    private config?;
    private readonly events;
    private last_flush_time;
    private flush_interval_ms;
    private constructor();
    static getInstance(config?: Config): ClearcutLogger | undefined;
    enqueueLogEvent(event: any): void;
    createLogEvent(name: string, data: object): object;
    flushIfNeeded(): void;
    flushToClearcut(): Promise<LogResponse>;
    decodeLogResponse(buf: Buffer): LogResponse | undefined;
    logStartSessionEvent(event: StartSessionEvent): void;
    logNewPromptEvent(event: UserPromptEvent): void;
    logToolCallEvent(event: ToolCallEvent): void;
    logApiRequestEvent(event: ApiRequestEvent): void;
    logApiResponseEvent(event: ApiResponseEvent): void;
    logApiErrorEvent(event: ApiErrorEvent): void;
    logEndSessionEvent(event: EndSessionEvent): void;
    shutdown(): void;
}
