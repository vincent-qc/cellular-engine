/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Buffer } from 'buffer';
import * as https from 'https';
import { EndSessionEvent, } from '../types.js';
import { EventMetadataKey } from './event-metadata-key.js';
import { getInstallationId } from '../../utils/user_id.js';
import { getGoogleAccountId } from '../../utils/user_id.js';
const start_session_event_name = 'start_session';
const new_prompt_event_name = 'new_prompt';
const tool_call_event_name = 'tool_call';
const api_request_event_name = 'api_request';
const api_response_event_name = 'api_response';
const api_error_event_name = 'api_error';
const end_session_event_name = 'end_session';
// Singleton class for batch posting log events to Clearcut. When a new event comes in, the elapsed time
// is checked and events are flushed to Clearcut if at least a minute has passed since the last flush.
export class ClearcutLogger {
    static instance;
    config;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Clearcut expects this format.
    events = [];
    last_flush_time = Date.now();
    flush_interval_ms = 1000 * 60; // Wait at least a minute before flushing events.
    constructor(config) {
        this.config = config;
    }
    static getInstance(config) {
        if (config === undefined || !config?.getUsageStatisticsEnabled())
            return undefined;
        if (!ClearcutLogger.instance) {
            ClearcutLogger.instance = new ClearcutLogger(config);
        }
        return ClearcutLogger.instance;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Clearcut expects this format.
    enqueueLogEvent(event) {
        this.events.push([
            {
                event_time_ms: Date.now(),
                source_extension_json: JSON.stringify(event),
            },
        ]);
    }
    createLogEvent(name, data) {
        return {
            console_type: 'GEMINI_CLI',
            application: 102,
            event_name: name,
            client_install_id: getInstallationId(),
            event_metadata: [data],
        };
    }
    flushIfNeeded() {
        if (Date.now() - this.last_flush_time < this.flush_interval_ms) {
            return;
        }
        // Fire and forget - don't await
        this.flushToClearcut().catch((error) => {
            console.debug('Error flushing to Clearcut:', error);
        });
    }
    async flushToClearcut() {
        if (this.config?.getDebugMode()) {
            console.log('Flushing log events to Clearcut.');
        }
        const eventsToSend = [...this.events];
        this.events.length = 0;
        const googleAccountId = await getGoogleAccountId();
        return new Promise((resolve, reject) => {
            const request = [
                {
                    log_source_name: 'CONCORD',
                    request_time_ms: Date.now(),
                    log_event: eventsToSend,
                    // Add UserInfo with the raw Gaia ID
                    user_info: googleAccountId
                        ? {
                            UserID: googleAccountId,
                        }
                        : undefined,
                },
            ];
            const body = JSON.stringify(request);
            const options = {
                hostname: 'play.googleapis.com',
                path: '/log',
                method: 'POST',
                headers: { 'Content-Length': Buffer.byteLength(body) },
            };
            const bufs = [];
            const req = https.request(options, (res) => {
                res.on('data', (buf) => bufs.push(buf));
                res.on('end', () => {
                    resolve(Buffer.concat(bufs));
                });
            });
            req.on('error', (e) => {
                if (this.config?.getDebugMode()) {
                    console.log('Clearcut POST request error: ', e);
                }
                // Add the events back to the front of the queue to be retried.
                this.events.unshift(...eventsToSend);
                reject(e);
            });
            req.end(body);
        })
            .then((buf) => {
            try {
                this.last_flush_time = Date.now();
                return this.decodeLogResponse(buf) || {};
            }
            catch (error) {
                console.error('Error flushing log events:', error);
                return {};
            }
        })
            .catch((error) => {
            // Handle all errors to prevent unhandled promise rejections
            console.error('Error flushing log events:', error);
            // Return empty response to maintain the Promise<LogResponse> contract
            return {};
        });
    }
    // Visible for testing. Decodes protobuf-encoded response from Clearcut server.
    decodeLogResponse(buf) {
        // TODO(obrienowen): return specific errors to facilitate debugging.
        if (buf.length < 1) {
            return undefined;
        }
        // The first byte of the buffer is `field<<3 | type`. We're looking for field
        // 1, with type varint, represented by type=0. If the first byte isn't 8, that
        // means field 1 is missing or the message is corrupted. Either way, we return
        // undefined.
        if (buf.readUInt8(0) !== 8) {
            return undefined;
        }
        let ms = BigInt(0);
        let cont = true;
        // In each byte, the most significant bit is the continuation bit. If it's
        // set, we keep going. The lowest 7 bits, are data bits. They are concatenated
        // in reverse order to form the final number.
        for (let i = 1; cont && i < buf.length; i++) {
            const byte = buf.readUInt8(i);
            ms |= BigInt(byte & 0x7f) << BigInt(7 * (i - 1));
            cont = (byte & 0x80) !== 0;
        }
        if (cont) {
            // We have fallen off the buffer without seeing a terminating byte. The
            // message is corrupted.
            return undefined;
        }
        const returnVal = {
            nextRequestWaitMs: Number(ms),
        };
        return returnVal;
    }
    logStartSessionEvent(event) {
        const data = [
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_MODEL,
                value: event.model,
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_EMBEDDING_MODEL,
                value: event.embedding_model,
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_SANDBOX,
                value: event.sandbox_enabled.toString(),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_CORE_TOOLS,
                value: event.core_tools_enabled,
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_APPROVAL_MODE,
                value: event.approval_mode,
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_API_KEY_ENABLED,
                value: event.api_key_enabled.toString(),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_VERTEX_API_ENABLED,
                value: event.vertex_ai_enabled.toString(),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_DEBUG_MODE_ENABLED,
                value: event.debug_enabled.toString(),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_VERTEX_API_ENABLED,
                value: event.vertex_ai_enabled.toString(),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_MCP_SERVERS,
                value: event.mcp_servers,
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_VERTEX_API_ENABLED,
                value: event.vertex_ai_enabled.toString(),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_TELEMETRY_ENABLED,
                value: event.telemetry_enabled.toString(),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_TELEMETRY_LOG_USER_PROMPTS_ENABLED,
                value: event.telemetry_log_user_prompts_enabled.toString(),
            },
        ];
        this.enqueueLogEvent(this.createLogEvent(start_session_event_name, data));
        // Flush start event immediately
        this.flushToClearcut().catch((error) => {
            console.debug('Error flushing start session event to Clearcut:', error);
        });
    }
    logNewPromptEvent(event) {
        const data = [
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_USER_PROMPT_LENGTH,
                value: JSON.stringify(event.prompt_length),
            },
        ];
        this.enqueueLogEvent(this.createLogEvent(new_prompt_event_name, data));
        this.flushToClearcut().catch((error) => {
            console.debug('Error flushing to Clearcut:', error);
        });
    }
    logToolCallEvent(event) {
        const data = [
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_NAME,
                value: JSON.stringify(event.function_name),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_DECISION,
                value: JSON.stringify(event.decision),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_SUCCESS,
                value: JSON.stringify(event.success),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_DURATION_MS,
                value: JSON.stringify(event.duration_ms),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_ERROR_MESSAGE,
                value: JSON.stringify(event.error),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_ERROR_TYPE,
                value: JSON.stringify(event.error_type),
            },
        ];
        this.enqueueLogEvent(this.createLogEvent(tool_call_event_name, data));
        this.flushToClearcut().catch((error) => {
            console.debug('Error flushing to Clearcut:', error);
        });
    }
    logApiRequestEvent(event) {
        const data = [
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_REQUEST_MODEL,
                value: JSON.stringify(event.model),
            },
        ];
        this.enqueueLogEvent(this.createLogEvent(api_request_event_name, data));
        this.flushToClearcut().catch((error) => {
            console.debug('Error flushing to Clearcut:', error);
        });
    }
    logApiResponseEvent(event) {
        const data = [
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_MODEL,
                value: JSON.stringify(event.model),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_STATUS_CODE,
                value: JSON.stringify(event.status_code),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_DURATION_MS,
                value: JSON.stringify(event.duration_ms),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_MESSAGE,
                value: JSON.stringify(event.error),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_INPUT_TOKEN_COUNT,
                value: JSON.stringify(event.input_token_count),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_OUTPUT_TOKEN_COUNT,
                value: JSON.stringify(event.output_token_count),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_CACHED_TOKEN_COUNT,
                value: JSON.stringify(event.cached_content_token_count),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_THINKING_TOKEN_COUNT,
                value: JSON.stringify(event.thoughts_token_count),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_TOOL_TOKEN_COUNT,
                value: JSON.stringify(event.tool_token_count),
            },
        ];
        this.enqueueLogEvent(this.createLogEvent(api_response_event_name, data));
        this.flushToClearcut().catch((error) => {
            console.debug('Error flushing to Clearcut:', error);
        });
    }
    logApiErrorEvent(event) {
        const data = [
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_MODEL,
                value: JSON.stringify(event.model),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_TYPE,
                value: JSON.stringify(event.error_type),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_STATUS_CODE,
                value: JSON.stringify(event.status_code),
            },
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_DURATION_MS,
                value: JSON.stringify(event.duration_ms),
            },
        ];
        this.enqueueLogEvent(this.createLogEvent(api_error_event_name, data));
        this.flushToClearcut().catch((error) => {
            console.debug('Error flushing to Clearcut:', error);
        });
    }
    logEndSessionEvent(event) {
        const data = [
            {
                gemini_cli_key: EventMetadataKey.GEMINI_CLI_END_SESSION_ID,
                value: event?.session_id?.toString() ?? '',
            },
        ];
        this.enqueueLogEvent(this.createLogEvent(end_session_event_name, data));
        // Flush immediately on session end.
        this.flushToClearcut().catch((error) => {
            console.debug('Error flushing to Clearcut:', error);
        });
    }
    shutdown() {
        const event = new EndSessionEvent(this.config);
        this.logEndSessionEvent(event);
    }
}
//# sourceMappingURL=clearcut-logger.js.map