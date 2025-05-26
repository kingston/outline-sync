import { z } from 'zod';

export const outlineConfigSchema = z.object({
  apiUrl: z.string().url().default('https://app.getoutline.com/api'),
});

export const collectionMcpConfigSchema = z.object({
  enabled: z.boolean().default(false),
  readOnly: z.boolean().default(false),
});

export const collectionConfigSchema = z.object({
  urlId: z.string(),
  directory: z.string().min(1).optional(),
  mcp: collectionMcpConfigSchema.default({}),
});

export const behaviorConfigSchema = z.object({
  skipMetadata: z.boolean().default(false),
  cleanupAfterDownload: z.boolean().default(true),
  includeImages: z.boolean().default(true),
});

export const mcpServerConfigSchema = z.object({
  transport: z.enum(['stdio', 'streamable-http']).default('stdio'),
  port: z.number().int().min(1).max(65_535).default(3000),
});

export const languageModelConfigSchema = z.object({
  provider: z.enum(['anthropic', 'google', 'openai']),
  embeddingsProvider: z.enum(['openai', 'google']).optional(),
  model: z.string().optional(),
  searchIndexDirectory: z.string().default('.outline-sync'),
});

export const configSchema = z.object({
  outline: outlineConfigSchema.default({}),
  collections: z.array(collectionConfigSchema).default([]),
  outputDir: z.string().min(1).default('docs'),
  behavior: behaviorConfigSchema.default({}),
  mcp: mcpServerConfigSchema.default({}),
  languageModel: languageModelConfigSchema.optional(),
});

export type OutlineConfig = z.infer<typeof outlineConfigSchema>;
export type CollectionMcpConfig = z.infer<typeof collectionMcpConfigSchema>;
export type DocumentCollectionConfig = z.infer<typeof collectionConfigSchema>;
export type BehaviorConfig = z.infer<typeof behaviorConfigSchema>;
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type LanguageModelConfig = z.infer<typeof languageModelConfigSchema>;
export type Config = z.infer<typeof configSchema>;

/**
 * Options for the download command
 */
export interface DownloadOptions {
  /** Custom output directory (overrides config) */
  dir?: string;
  /** Filter collections by URL IDs */
  collections?: string[];
}

/**
 * Options for the upload command
 */
export interface UploadOptions {
  /** Source directory to upload from (overrides config) */
  dir?: string;
  /** Filter collections by URL IDs */
  collections?: string[];
  /** Only update existing documents, don't create new ones */
  updateOnly?: boolean;
}

/**
 * Options for the MCP command
 */
export interface McpOptions {
  /** Custom output directory (overrides config) */
  dir?: string;
  /** Filter collections by URL IDs */
  collections?: string[];
  /** MCP server transport */
  transport?: 'stdio' | 'streamable-http';
  /** MCP server port */
  port?: number;
}

/**
 * Options for the annotate command
 */
export interface AnnotateOptions {
  /** Custom output directory (overrides config) */
  dir?: string;
  /** Filter collections by URL IDs */
  collections?: string[];
}

export interface SearchOptions {
  dir?: string;
  collections?: string[];
  query: string;
  includeContents?: boolean;
  limit?: string;
}
