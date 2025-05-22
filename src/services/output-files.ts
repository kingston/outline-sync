import matter from 'gray-matter';
import { promises as fs } from 'node:fs';
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
async function readDocumentFile(
  filePath: string,
  collectionId: string,
  parentDocumentId?: string,
): Promise<ParsedDocument> {
  const fileContent = await fs.readFile(filePath, 'utf8');
  const parsed = matter(fileContent);

  try {
    return {
      metadata: documentFrontmatterSchema.parse(parsed.data),
      content: parsed.content,
      filePath,
      collectionId,
      parentDocumentId,
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
  const parsedDocuments: ParsedDocument[] = [];

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
        throw new Error(
          `Index file ${indexPath} not found. All subdirectories must have an index.md file.`,
        );
      }
      const indexDocument = await readDocumentFile(
        indexPath,
        collection.id,
        parentDocumentId,
      );
      parsedDocuments.push(
        indexDocument,
        ...(await readCollectionFilesForDirectory(
          fullPath,
          collection,
          indexDocument.metadata.outlineId,
        )),
      );
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      parsedDocuments.push(
        await readDocumentFile(fullPath, collection.id, parentDocumentId),
      );
    }
  }

  return parsedDocuments;
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
