import matter from 'gray-matter';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import {
  documentFrontmatterSchema,
  type ParsedDocument,
} from '@src/types/documents.js';
import { fileExists } from '@src/utils/file-manager.js';

/**
 * Read and parse a document file with frontmatter
 *
 * @param filePath - The path to the document file
 * @returns The parsed document
 */
export async function readDocumentFile(
  filePath: string,
  collection: DocumentCollectionWithConfig,
  parentDocumentId?: string,
): Promise<Omit<ParsedDocument, 'relativeIndex'>> {
  const fileContent = await fs.readFile(filePath, 'utf8');
  const fileStat = await fs.stat(filePath);
  const parsed = matter(fileContent);

  try {
    return {
      metadata: documentFrontmatterSchema.parse(parsed.data),
      content: parsed.content,
      filePath,
      relativePath: path.relative(collection.outputDirectory, filePath),
      collectionId: collection.id,
      parentDocumentId,
      lastModifiedAt: fileStat.mtime,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse document file ${filePath}: ${String(error)}`,
    );
  }
}

/**
 * Read all documents in a directory
 *
 * @param dirPath - The path to the directory
 * @returns The parsed documents
 */
async function readCollectionFilesForDirectory(
  dirPath: string,
  collection: DocumentCollectionWithConfig,
  parentDocumentId?: string,
): Promise<ParsedDocument[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const parsedDocuments: Omit<ParsedDocument, 'relativeIndex'>[] = [];
  const childrenParsedDocuments: ParsedDocument[] = [];

  for (const entry of entries) {
    // we've already parsed index.md
    if (parentDocumentId && entry.name === 'index.md') {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // look for index.md in the directory
      const indexPath = path.join(fullPath, 'index.md');
      if (!(await fileExists(indexPath))) {
        // check if there are other md files in the directory
        const otherMdFiles = await fs.readdir(fullPath);
        if (otherMdFiles.some((file) => file.endsWith('.md'))) {
          throw new Error(
            `Index file ${indexPath} not found. All subdirectories with md files must have an index.md file.`,
          );
        } else {
          continue;
        }
      }
      const indexDocument = await readDocumentFile(
        indexPath,
        collection,
        parentDocumentId,
      );
      parsedDocuments.push(indexDocument);
      childrenParsedDocuments.push(
        ...(await readCollectionFilesForDirectory(
          fullPath,
          collection,
          // fallback to the file path if the outline ID is not set
          indexDocument.metadata.outlineId ?? indexDocument.filePath,
        )),
      );
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      parsedDocuments.push(
        await readDocumentFile(fullPath, collection, parentDocumentId),
      );
    }
  }

  return [
    ...parsedDocuments
      .toSorted(
        (a, b) =>
          (a.metadata.sidebar?.order ?? 0) - (b.metadata.sidebar?.order ?? 0),
      )
      .map((doc, index) => ({
        ...doc,
        relativeIndex: index,
      })),
    ...childrenParsedDocuments,
  ];
}

/**
 * Read all documents in a collection folder
 *
 * @param collection - The collection to read
 * @returns The parsed documents
 */
export async function readCollectionFiles(
  collection: DocumentCollectionWithConfig,
): Promise<ParsedDocument[]> {
  return readCollectionFilesForDirectory(
    collection.outputDirectory,
    collection,
  );
}

/**
 * Get all file paths from a directory recursively
 */
async function getAllPaths(
  dirPath: string,
  paths = new Set<string>(),
): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      paths.add(fullPath);

      if (entry.isDirectory()) {
        await getAllPaths(fullPath, paths);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return paths;
}

/**
 * Clean up files that were not written during the current download
 *
 * @param outputDirectory - The output directory to clean
 * @param writtenPaths - Set of paths that were written
 * @returns Number of files/directories deleted
 */
export async function cleanupUnwrittenFiles(
  outputDirectory: string,
  writtenPaths: Set<string>,
): Promise<number> {
  const allPaths = await getAllPaths(outputDirectory);
  let deletedCount = 0;

  // Sort paths by depth (deepest first) to delete files before directories
  const sortedPaths = [...allPaths].sort(
    (a, b) => b.split(path.sep).length - a.split(path.sep).length,
  );

  for (const filePath of sortedPaths) {
    if (!writtenPaths.has(filePath)) {
      try {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          // Only delete empty directories
          const contents = await fs.readdir(filePath);
          if (contents.length === 0) {
            await fs.rmdir(filePath);
            deletedCount++;
          }
        } else {
          await fs.unlink(filePath);
          deletedCount++;
        }
      } catch {
        // File already deleted or doesn't exist
      }
    }
  }

  return deletedCount;
}
