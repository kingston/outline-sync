import { z } from 'zod';

export const outlineConfigSchema = z.object({
  apiUrl: z.string().url().default('https://app.getoutline.com/api'),
});

export const directoriesConfigSchema = z.object({
  download: z.string().min(1).default('./docs'),
  upload: z.string().min(1).default('./docs'),
});

export const behaviorConfigSchema = z.object({
  skipMetadata: z.boolean().default(false),
});

export const configSchema = z.object({
  outline: outlineConfigSchema.default({}),
  collections: z.array(z.string()),
  directories: directoriesConfigSchema.default({}),
  behavior: behaviorConfigSchema.default({}),
});

export type OutlineConfig = z.infer<typeof outlineConfigSchema>;
export type DirectoriesConfig = z.infer<typeof directoriesConfigSchema>;
export type BehaviorConfig = z.infer<typeof behaviorConfigSchema>;
export type Config = z.infer<typeof configSchema>;

/**
 * Options for the download command
 */
export interface DownloadOptions {
  /** Custom output directory (overrides config) */
  dir?: string;
  /** Download all collections instead of configured ones */
  all?: boolean;
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
