import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { DocumentCollection } from '@src/types/collections.js';
import type { ParsedDocument } from '@src/types/documents.js';

import { directoryExists, readDocumentFile } from './file-manager.js';

/**
 * Find parent document ID by searching sibling and parent index.md files
 */
export async function findParentDocumentId(
  filePath: string,
  collections: DocumentCollection[],
): Promise<{
  parentDocumentId: string | undefined;
  collectionId: string | undefined;
  targetPath?: string;
}> {
  const fileName = path.basename(filePath);
  const dirPath = path.dirname(filePath);

  // If this is already an index.md file, look for parent directory's index.md
  if (fileName === 'index.md') {
    return findParentFromParentDirectory(dirPath, collections);
  }

  // Otherwise, look for sibling index.md first
  const siblingResult = await findParentFromSiblingIndex(dirPath, collections);
  if (siblingResult.parentDocumentId) {
    return siblingResult;
  }

  // Fallback to parent directory's index.md
  return findParentFromParentDirectory(dirPath, collections);
}

/**
 * Look for index.md in the same directory (sibling)
 */
async function findParentFromSiblingIndex(
  dirPath: string,
  collections: DocumentCollection[],
): Promise<{
  parentDocumentId: string | undefined;
  collectionId: string | undefined;
}> {
  const indexPath = path.join(dirPath, 'index.md');

  try {
    const indexDoc = await readDocumentFile(indexPath);
    if (indexDoc.metadata.outlineId) {
      const collectionId = findCollectionIdFromMetadata(indexDoc, collections);
      return {
        parentDocumentId: indexDoc.metadata.outlineId,
        collectionId,
      };
    }
  } catch {
    // index.md doesn't exist or can't be read
  }

  return {
    parentDocumentId: undefined,
    collectionId: undefined,
  };
}

/**
 * Look for index.md in the parent directory
 */
async function findParentFromParentDirectory(
  dirPath: string,
  collections: DocumentCollection[],
): Promise<{
  parentDocumentId: string | undefined;
  collectionId: string | undefined;
}> {
  const parentDir = path.dirname(dirPath);

  // Don't go beyond the root directory
  if (parentDir === dirPath) {
    return {
      parentDocumentId: undefined,
      collectionId: undefined,
    };
  }

  const parentIndexPath = path.join(parentDir, 'index.md');

  try {
    const parentIndexDoc = await readDocumentFile(parentIndexPath);
    if (parentIndexDoc.metadata.outlineId) {
      const collectionId = findCollectionIdFromMetadata(
        parentIndexDoc,
        collections,
      );
      return {
        parentDocumentId: parentIndexDoc.metadata.outlineId,
        collectionId,
      };
    }
  } catch {
    // parent index.md doesn't exist or can't be read
  }

  return {
    parentDocumentId: undefined,
    collectionId: undefined,
  };
}

/**
 * Find collection ID from document metadata or infer from directory structure
 */
function findCollectionIdFromMetadata(
  doc: ParsedDocument,
  collections: DocumentCollection[],
): string | undefined {
  // Try to find collection by matching directory structure or other heuristics
  // For now, return undefined - could be enhanced based on your specific needs
  return undefined;
}

/**
 * Determine if a file should be moved based on its metadata vs resolved parent/collection
 */
export async function shouldMoveFile(
  filePath: string,
  resolvedParentId: string | undefined,
  resolvedCollectionId: string | undefined,
  collections: DocumentCollection[],
): Promise<{
  shouldMove: boolean;
  targetPath?: string;
  reason?: string;
}> {
  try {
    const doc = await readDocumentFile(filePath);
    const currentDir = path.dirname(filePath);

    // Check if the file's expected location matches its current location
    if (resolvedCollectionId && resolvedParentId) {
      const collection = collections.find((c) => c.id === resolvedCollectionId);
      if (collection) {
        // Generate expected path based on collection and parent
        const expectedPath = generateExpectedPath(
          doc,
          collection,
          resolvedParentId,
        );

        if (expectedPath && expectedPath !== filePath) {
          return {
            shouldMove: true,
            targetPath: expectedPath,
            reason: 'File location does not match expected collection/parent structure',
          };
        }
      }
    }

    return { shouldMove: false };
  } catch {
    return { shouldMove: false };
  }
}

/**
 * Generate expected file path based on collection and parent document
 */
function generateExpectedPath(
  doc: ParsedDocument,
  collection: DocumentCollection,
  parentDocumentId: string,
): string | undefined {
  // This is a placeholder - you would implement logic based on your directory structure conventions
  // For example, you might want files to be organized like:
  // collections/{collection-name}/{parent-title}/{file-name}.md
  return undefined;
}

/**
 * Move a file to its correct location
 */
export async function moveFileToCorrectLocation(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  // Ensure target directory exists
  const targetDir = path.dirname(targetPath);
  if (!(await directoryExists(targetDir))) {
    await fs.mkdir(targetDir, { recursive: true });
  }

  // Move the file
  await fs.rename(sourcePath, targetPath);
}