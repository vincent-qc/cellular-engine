/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'fs';
import path from 'path';
import { BaseTool } from './tools.js';
import { SchemaValidator } from '../utils/schemaValidator.js';
import { makeRelative, shortenPath } from '../utils/paths.js';
/**
 * Implementation of the LS tool logic
 */
export class LSTool extends BaseTool {
    rootDirectory;
    config;
    static Name = 'list_directory';
    /**
     * Creates a new instance of the LSLogic
     * @param rootDirectory Root directory to ground this tool in. All operations will be restricted to this directory.
     */
    constructor(rootDirectory, config) {
        super(LSTool.Name, 'ReadFolder', 'Lists the names of files and subdirectories directly within a specified directory path. Can optionally ignore entries matching provided glob patterns.', {
            properties: {
                path: {
                    description: 'The absolute path to the directory to list (must be absolute, not relative)',
                    type: 'string',
                },
                ignore: {
                    description: 'List of glob patterns to ignore',
                    items: {
                        type: 'string',
                    },
                    type: 'array',
                },
                respect_git_ignore: {
                    description: 'Optional: Whether to respect .gitignore patterns when listing files. Only available in git repositories. Defaults to true.',
                    type: 'boolean',
                },
            },
            required: ['path'],
            type: 'object',
        });
        this.rootDirectory = rootDirectory;
        this.config = config;
        // Set the root directory
        this.rootDirectory = path.resolve(rootDirectory);
    }
    /**
     * Checks if a path is within the root directory
     * @param dirpath The path to check
     * @returns True if the path is within the root directory, false otherwise
     */
    isWithinRoot(dirpath) {
        const normalizedPath = path.normalize(dirpath);
        const normalizedRoot = path.normalize(this.rootDirectory);
        // Ensure the normalizedRoot ends with a path separator for proper path comparison
        const rootWithSep = normalizedRoot.endsWith(path.sep)
            ? normalizedRoot
            : normalizedRoot + path.sep;
        return (normalizedPath === normalizedRoot ||
            normalizedPath.startsWith(rootWithSep));
    }
    /**
     * Validates the parameters for the tool
     * @param params Parameters to validate
     * @returns An error message string if invalid, null otherwise
     */
    validateToolParams(params) {
        if (this.schema.parameters &&
            !SchemaValidator.validate(this.schema.parameters, params)) {
            return 'Parameters failed schema validation.';
        }
        if (!path.isAbsolute(params.path)) {
            return `Path must be absolute: ${params.path}`;
        }
        if (!this.isWithinRoot(params.path)) {
            return `Path must be within the root directory (${this.rootDirectory}): ${params.path}`;
        }
        return null;
    }
    /**
     * Checks if a filename matches any of the ignore patterns
     * @param filename Filename to check
     * @param patterns Array of glob patterns to check against
     * @returns True if the filename should be ignored
     */
    shouldIgnore(filename, patterns) {
        if (!patterns || patterns.length === 0) {
            return false;
        }
        for (const pattern of patterns) {
            // Convert glob pattern to RegExp
            const regexPattern = pattern
                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            const regex = new RegExp(`^${regexPattern}$`);
            if (regex.test(filename)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Gets a description of the file reading operation
     * @param params Parameters for the file reading
     * @returns A string describing the file being read
     */
    getDescription(params) {
        const relativePath = makeRelative(params.path, this.rootDirectory);
        return shortenPath(relativePath);
    }
    // Helper for consistent error formatting
    errorResult(llmContent, returnDisplay) {
        return {
            llmContent,
            // Keep returnDisplay simpler in core logic
            returnDisplay: `Error: ${returnDisplay}`,
        };
    }
    /**
     * Executes the LS operation with the given parameters
     * @param params Parameters for the LS operation
     * @returns Result of the LS operation
     */
    async execute(params, _signal) {
        const validationError = this.validateToolParams(params);
        if (validationError) {
            return this.errorResult(`Error: Invalid parameters provided. Reason: ${validationError}`, `Failed to execute tool.`);
        }
        try {
            const stats = fs.statSync(params.path);
            if (!stats) {
                // fs.statSync throws on non-existence, so this check might be redundant
                // but keeping for clarity. Error message adjusted.
                return this.errorResult(`Error: Directory not found or inaccessible: ${params.path}`, `Directory not found or inaccessible.`);
            }
            if (!stats.isDirectory()) {
                return this.errorResult(`Error: Path is not a directory: ${params.path}`, `Path is not a directory.`);
            }
            const files = fs.readdirSync(params.path);
            // Get centralized file discovery service
            const respectGitIgnore = params.respect_git_ignore ??
                this.config.getFileFilteringRespectGitIgnore();
            const fileDiscovery = this.config.getFileService();
            const entries = [];
            let gitIgnoredCount = 0;
            if (files.length === 0) {
                // Changed error message to be more neutral for LLM
                return {
                    llmContent: `Directory ${params.path} is empty.`,
                    returnDisplay: `Directory is empty.`,
                };
            }
            for (const file of files) {
                if (this.shouldIgnore(file, params.ignore)) {
                    continue;
                }
                const fullPath = path.join(params.path, file);
                const relativePath = path.relative(this.rootDirectory, fullPath);
                // Check if this file should be git-ignored (only in git repositories)
                if (respectGitIgnore &&
                    fileDiscovery.shouldGitIgnoreFile(relativePath)) {
                    gitIgnoredCount++;
                    continue;
                }
                try {
                    const stats = fs.statSync(fullPath);
                    const isDir = stats.isDirectory();
                    entries.push({
                        name: file,
                        path: fullPath,
                        isDirectory: isDir,
                        size: isDir ? 0 : stats.size,
                        modifiedTime: stats.mtime,
                    });
                }
                catch (error) {
                    // Log error internally but don't fail the whole listing
                    console.error(`Error accessing ${fullPath}: ${error}`);
                }
            }
            // Sort entries (directories first, then alphabetically)
            entries.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory)
                    return -1;
                if (!a.isDirectory && b.isDirectory)
                    return 1;
                return a.name.localeCompare(b.name);
            });
            // Create formatted content for LLM
            const directoryContent = entries
                .map((entry) => `${entry.isDirectory ? '[DIR] ' : ''}${entry.name}`)
                .join('\n');
            let resultMessage = `Directory listing for ${params.path}:\n${directoryContent}`;
            if (gitIgnoredCount > 0) {
                resultMessage += `\n\n(${gitIgnoredCount} items were git-ignored)`;
            }
            let displayMessage = `Listed ${entries.length} item(s).`;
            if (gitIgnoredCount > 0) {
                displayMessage += ` (${gitIgnoredCount} git-ignored)`;
            }
            return {
                llmContent: resultMessage,
                returnDisplay: displayMessage,
            };
        }
        catch (error) {
            const errorMsg = `Error listing directory: ${error instanceof Error ? error.message : String(error)}`;
            return this.errorResult(errorMsg, 'Failed to list directory.');
        }
    }
}
//# sourceMappingURL=ls.js.map