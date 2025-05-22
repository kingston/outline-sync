import { ensureDir, readFile, writeFile } from 'fs-extra';
import matter from 'gray-matter';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import slugify from 'slugify';

import {
  type DocumentFrontmatter,
  documentFrontmatterSchema,
  type ParsedDocument,
} from '../types/documents.js';

/**
 * Create a filesystem-safe filename from a document title
 */
export function createSafeFilename(title: string): string {
  return slugify.default(title, {
    lower: true,
    strict: true,
    replacement: '-',
  });
}

export function createSafeMarkdownFilename(title: string): string {
  return `${createSafeFilename(title)}.md`;
}

/**
 * Write a document to the filesystem with frontmatter
 */
export async function writeDocumentFile(
  filePath: string,
  content: string,
  metadata: DocumentFrontmatter | undefined,
): Promise<void> {
  await ensureDir(path.dirname(filePath));

  if (metadata) {
    const fileContent = matter.stringify(content, metadata);
    await writeFile(filePath, fileContent, 'utf8');
  } else {
    await writeFile(filePath, content, 'utf8');
  }
}

/**
 * Read and parse a document file with frontmatter
 */
export async function readDocumentFile(
  filePath: string,
): Promise<ParsedDocument> {
  const fileContent = await readFile(filePath, 'utf8');
  const parsed = matter(fileContent);

  try {
    return {
      metadata: documentFrontmatterSchema.parse(parsed.data),
      content: parsed.content,
      filePath,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse document file ${filePath} (note: metadata is required for upload operations): ${String(error)}`,
    );
  }
}

/**
 * Check if a directory exists
 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get all markdown files in a directory recursively
 */
export async function getMarkdownFiles(directory: string): Promise<string[]> {
  const files: string[] = [];

  async function scanDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
      return;
    }
  }

  await scanDirectory(directory);
  return files;
}
