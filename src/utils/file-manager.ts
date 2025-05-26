import matter from 'gray-matter';
import fs from 'node:fs/promises';
import path from 'node:path';

import { type DocumentFrontmatter } from '../types/documents.js';

/**
 * Write a document to the filesystem with frontmatter
 */
export async function writeDocumentFile(
  filePath: string,
  content: string,
  metadata: DocumentFrontmatter | undefined,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  if (metadata) {
    const strippedMetadata = Object.fromEntries(
      Object.entries(metadata).filter(
        ([, value]) => (value as unknown) !== undefined,
      ),
    );
    const fileContent = matter.stringify(content, strippedMetadata);
    await fs.writeFile(filePath, fileContent, 'utf8');
  } else {
    await fs.writeFile(filePath, content, 'utf8');
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
 * Checks if a file exists and is a file
 * @param filePath - The path to the file
 * @returns True if the file exists and is a file, false otherwise
 */
export async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .stat(filePath)
    .then((file) => file.isFile())
    .catch(() => false);
}
