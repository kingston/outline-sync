import { z } from 'zod';

export const outlineConfigSchema = z.object({
  apiUrl: z.string().url().default('https://app.getoutline.com/api'),
});

export const collectionConfigSchema = z.object({
  urlId: z.string(),
  directory: z.string().min(1).optional(),
});

export const behaviorConfigSchema = z.object({
  skipMetadata: z.boolean().default(false),
});

export const configSchema = z.object({
  outline: outlineConfigSchema.default({}),
  collections: z.array(collectionConfigSchema).default([]),
  outputDir: z.string().min(1).default('docs'),
  behavior: behaviorConfigSchema.default({}),
});

export type OutlineConfig = z.infer<typeof outlineConfigSchema>;
export type DocumentCollectionConfig = z.infer<typeof collectionConfigSchema>;
export type BehaviorConfig = z.infer<typeof behaviorConfigSchema>;
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
