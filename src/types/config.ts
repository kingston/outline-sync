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
  transport: z.enum(['stdio', 'sse']).default('stdio'),
  port: z.number().int().min(1).max(65_535).default(3000),
});

export const languageModelConfigSchema = z.object({
  provider: z.enum(['anthropic', 'google', 'openai']),
  model: z.string().optional(),
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
}

/**
 * Options for the upload command
 */
export interface UploadOptions {
  /** Source directory to upload from (overrides config) */
  source?: string;
  /** Target collection name or ID */
  collection?: string;
  /** Only update existing documents, don't create new ones */
  updateOnly?: boolean;
}
