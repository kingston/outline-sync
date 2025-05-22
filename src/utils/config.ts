import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ZodError } from 'zod';

import { type Config, configSchema } from '../types/config.js';
import { handleFileNotFoundError } from './handle-not-found-error.js';

/**
 * Load configuration from file or use defaults
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  const possiblePaths = [
    configPath,
    './outline-sync.config.json',
    path.join(process.cwd(), 'outline-sync.config.json'),
  ].filter((x) => x !== undefined);

  for (const path of possiblePaths) {
    try {
      const fileContent = await readFile(path, 'utf8').catch(
        handleFileNotFoundError,
      );
      if (fileContent === undefined) {
        continue;
      }
      const config = JSON.parse(fileContent) as Partial<Config>;
      return configSchema.parse(config);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new TypeError(`Validation failed for ${path}: ${error.message}`, {
          cause: error,
        });
      }
      if (error instanceof SyntaxError) {
        throw new TypeError(`Invalid JSON in file: ${path}`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  // No config file found, use defaults
  return configSchema.parse({});
}
