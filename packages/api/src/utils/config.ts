/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApprovalMode, Config as CoreConfig, createToolRegistry, DEFAULT_GEMINI_MODEL, FileDiscoveryService, ToolRegistry } from '@google/gemini-cli-core';

export class APIConfig extends CoreConfig {
  private apiKey: string;
  private workingDir: string;
  private _toolRegistry: ToolRegistry | null = null;
  private _fileDiscoveryService: FileDiscoveryService | null = null;

  constructor(apiKey: string, workingDir: string) {
    super({
      targetDir: workingDir,
      approvalMode: ApprovalMode.DEFAULT,
      debugMode: false,
      fullContext: false,
      sessionId: '',
      cwd: workingDir,
      model: DEFAULT_GEMINI_MODEL,
      coreTools: undefined,
      excludeTools: undefined,
    });
    this.apiKey = apiKey;
    this.workingDir = workingDir;
  }

  // Override methods to work in API context
  getWorkingDir(): string {
    return this.workingDir;
  }

  getTargetDir(): string {
    return this.workingDir;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  getProxy(): string | undefined {
    return process.env.HTTP_PROXY || process.env.HTTPS_PROXY || undefined;
  }

  setDebugMode(debugMode: boolean): void {
    // Use the inherited debugMode property through the constructor parameter
    // We can't directly modify it since it's readonly, but we can pass it to super
    // For now, we'll just log the change since the base class handles it
    console.log(`Setting debug mode to: ${debugMode}`);
  }

  getFileDiscoveryService(): FileDiscoveryService {
    if (!this._fileDiscoveryService) {
      this._fileDiscoveryService = new FileDiscoveryService(this.workingDir);
    }
    return this._fileDiscoveryService;
  }

  // Override getToolRegistry to properly initialize it
  async getToolRegistry() {
    if (!this._toolRegistry) {
      this._toolRegistry = await createToolRegistry(this);
    }
    return this._toolRegistry;
  }
}