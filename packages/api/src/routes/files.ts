/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Body, Controller, Get, Post, QueryParam } from 'routing-controllers';
import { EngineService } from '../utils/gemini.js';

const ROOT_DIR = '/Users/vincentqi/Developer/GitHub/cf';

interface ReadFileBody {
  path: string;
}

interface WriteFileBody {
  path: string;
  content: string;
}

@Controller('/files')
export class FilesController {
  private engine: EngineService;

  constructor() {
    this.engine = new EngineService(process.env.GEMINI_API_KEY!, ROOT_DIR);
  }

  // List files in a directory
  @Get('/list')
  async listFiles(@QueryParam('path') dirPath: string = '.') {
    try {
      let absPath = dirPath;
      if (!absPath || absPath === '.' || absPath === '') {
        absPath = ROOT_DIR;
      } else if (!path.isAbsolute(absPath)) {
        absPath = path.resolve(ROOT_DIR, absPath);
      }
      if (!absPath.startsWith(ROOT_DIR)) {
        throw new Error('Access denied: Path outside of root directory');
      }
      console.log('DEBUG: Listing directory:', absPath);
      const files = fs.readdirSync(absPath, { withFileTypes: true });
      const result = files.map((entry) => ({
        name: entry.name,
        path: path.relative(ROOT_DIR, path.join(absPath, entry.name)),
        isDirectory: entry.isDirectory(),
      }));
      return { result };
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`);
    }
  }

  // Read a file
  @Post('/read')
  async readFile(@Body() body: ReadFileBody) {
    try {
      const absPath = path.isAbsolute(body.path) ? body.path : path.resolve(ROOT_DIR, body.path);
      if (!absPath.startsWith(ROOT_DIR)) {
        throw new Error('Access denied: Path outside of root directory');
      }
      const content = fs.readFileSync(absPath, 'utf-8');
      return { result: { content } };
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  // Write a file
  @Post('/write')
  async writeFile(@Body() body: WriteFileBody) {
    try {
      const absPath = path.isAbsolute(body.path) ? body.path : path.resolve(ROOT_DIR, body.path);
      if (!absPath.startsWith(ROOT_DIR)) {
        throw new Error('Access denied: Path outside of root directory');
      }
      fs.writeFileSync(absPath, body.content, 'utf-8');
      return { result: { success: true } };
    } catch (error) {
      throw new Error(`Failed to write file: ${error}`);
    }
  }

  @Post('/grep')
  async grepFiles(@Body() body: { pattern: string; path?: string }) {
    try {
      const result = await this.engine.executeTool('grep', { 
        pattern: body.pattern, 
        path: body.path || '.' 
      });
      return { result };
    } catch (error) {
      throw new Error(`Failed to search files: ${error}`);
    }
  }

  @Post('/glob')
  async globFiles(@Body() body: { pattern: string }) {
    try {
      const result = await this.engine.executeTool('glob', { pattern: body.pattern });
      return { result };
    } catch (error) {
      throw new Error(`Failed to glob files: ${error}`);
    }
  }
} 