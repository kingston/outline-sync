import chalk from 'chalk';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';
import { z } from 'zod';

import type { ImageUploadInfo } from '@src/services/attachments.js';
import type { DocumentCollection } from '@src/types/collections.js';

import {
  parseRelativeImages,
  transformMarkdownToAttachments,
} from '@src/services/attachments.js';
import { readCollectionFiles } from '@src/services/output-files.js';

import type { OutlineService } from '../services/outline.js';
import type { Config, UploadOptions } from '../types/config.js';
import type { Document, ParsedDocument } from '../types/documents.js';
import type { DocumentCollectionWithConfig } from '../utils/collection-filter.js';

import { getOutlineService } from '../services/outline.js';
import { getCollectionConfigs } from '../utils/collection-filter.js';
import { writeDocumentFile } from '../utils/file-manager.js';

const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Upload local markdown files to Outline
 */
export async function uploadCommand(
  config: Config,
  options: UploadOptions,
): Promise<void> {
  const spinner = ora({
    hideCursor: false,
    text: 'Initializing upload...',
  }).start();

  try {
    const outlineService = getOutlineService(config.outline.apiUrl);

    spinner.text = 'Scanning for markdown files...';

    spinner.text = 'Fetching collections from Outline...';
    const allCollections = await outlineService.getCollections();
    const collectionsToProcess = getCollectionConfigs(allCollections, config, {
      collectionUrlIdsFilter: options.collections,
      outputDir: options.dir,
    });

    if (collectionsToProcess.length === 0) {
      spinner.fail('No collections found to process');
      return;
    }

    spinner.succeed(
      `Found ${collectionsToProcess.length.toString()} collection(s) to process`,
    );

    // Process each collection individually
    for (const collection of collectionsToProcess) {
      await processCollectionFiles(
        outlineService,
        collection,
        options,
        config.behavior.includeImages,
      );
    }

    if (!IS_TEST) {
      console.info(chalk.green('\n✓ Upload completed successfully!'));
    }
  } catch (error) {
    spinner.fail('Upload failed');
    throw error;
  }
}

/**
 * Process files for a specific collection
 */
async function processCollectionFiles(
  outlineService: OutlineService,
  collection: DocumentCollectionWithConfig,
  options: UploadOptions,
  includeImages: boolean,
): Promise<void> {
  const spinner = ora({
    hideCursor: false,
    text: `Processing collection: ${collection.name}`,
  }).start();

  let uploadedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let lastError: unknown;

  const filesToUpload = await readCollectionFiles(collection);

  // Map to track file paths to document IDs for parent resolution
  const filePathToDocumentId = new Map<string, string>();

  // Process documents in order (parents before children)
  for (const file of filesToUpload) {
    try {
      // Resolve parent document ID if it's a file path
      let resolvedParentId = file.parentDocumentId;
      if (
        resolvedParentId &&
        !z.string().uuid().safeParse(resolvedParentId).success
      ) {
        // This looks like a file path, not a document ID
        const parentDocId = filePathToDocumentId.get(resolvedParentId);
        if (parentDocId) {
          resolvedParentId = parentDocId;
        } else {
          // Parent hasn't been created yet - this shouldn't happen with proper ordering
          throw new Error(
            `Parent document not found for file path: ${resolvedParentId}`,
          );
        }
      }

      const fileWithResolvedParent = {
        ...file,
        parentDocumentId: resolvedParentId,
      };

      const result = await uploadFile(
        outlineService,
        fileWithResolvedParent,
        collection,
        options,
        includeImages,
      );

      switch (result.status) {
        case 'created': {
          uploadedCount++;
          // Track the mapping from file path to document ID
          filePathToDocumentId.set(file.filePath, result.document.id);
          break;
        }
        case 'updated': {
          updatedCount++;
          // Also track for updated documents
          filePathToDocumentId.set(file.filePath, result.document.id);
          break;
        }
        case 'skipped': {
          skippedCount++;
          // For skipped documents with outline IDs, still track them
          if (file.metadata.outlineId) {
            filePathToDocumentId.set(file.filePath, file.metadata.outlineId);
          } else if (result.document) {
            filePathToDocumentId.set(file.filePath, result.document.id);
          }
          break;
        }
      }

      spinner.text = `Processing ${collection.name}: Created ${String(uploadedCount)}, Updated ${String(updatedCount)}, Skipped ${String(skippedCount)}`;
    } catch (error) {
      errorCount++;
      console.info(chalk.red(`\n  ✗ Failed: ${file.filePath}`));
      console.info(chalk.red(`     ${String(error)}`));
      if (IS_TEST) {
        throw error;
      }
      lastError = error;
    }
  }

  if (errorCount > 0) {
    spinner.fail(
      `  ${collection.name}: Created ${String(uploadedCount)}, Updated ${String(updatedCount)}, Skipped ${String(skippedCount)}, Errors ${String(errorCount)}`,
    );
    throw lastError;
  }

  spinner.succeed(
    `  ${collection.name}: Created ${String(uploadedCount)}, Updated ${String(updatedCount)}, Skipped ${String(skippedCount)}, Errors ${String(errorCount)}`,
  );
}

interface UploadSkippedResult {
  status: 'skipped';
  document?: Document;
}

interface UploadCreatedResult {
  status: 'created';
  document: Document;
}

interface UploadUpdatedResult {
  status: 'updated';
  document: Document;
}

type UploadResult =
  | UploadSkippedResult
  | UploadCreatedResult
  | UploadUpdatedResult;

/**
 * Upload a single file to Outline
 */
async function uploadFile(
  outlineService: OutlineService,
  file: ParsedDocument,
  collection: DocumentCollection,
  options: UploadOptions,
  includeImages: boolean,
): Promise<UploadResult> {
  // Get the document from Outline if it exists
  const document =
    file.metadata.outlineId === undefined
      ? undefined
      : await outlineService.getDocument(file.metadata.outlineId);

  if (!document && options.updateOnly) {
    return { status: 'skipped' };
  }

  // If document has metadata, use it for upload
  return document
    ? updateExistingDocument(outlineService, file, document, includeImages)
    : createNewDocument(
        outlineService,
        file,
        collection,
        file.parentDocumentId,
        includeImages,
      );
}

/**
 * Process images in markdown content
 */
async function processImagesInContent(
  outlineService: OutlineService,
  content: string,
  documentId: string,
  filePath: string,
  images: ImageUploadInfo[],
): Promise<string> {
  let processedContent = content;

  // Then handle new images that need to be uploaded
  for (const image of images) {
    if (!image.isExistingAttachment) {
      const imageFullPath = path.join(
        path.dirname(filePath),
        image.relativePath,
      );

      try {
        // Check if image file exists
        await stat(imageFullPath);

        // Upload the image
        const attachment = await outlineService.uploadAttachment({
          documentId,
          filePath: imageFullPath,
        });

        // Replace the relative path with the attachment URL (preserving annotations)
        const originalPattern = `![${image.caption}](./${image.relativePath}${image.annotations ?? ''})`;
        const replacement = `![${image.caption}](${attachment.url}${image.annotations ?? ''})`;
        processedContent = processedContent.replace(
          originalPattern,
          replacement,
        );
      } catch (error) {
        console.error(
          chalk.red(`\n  ✗ Failed to upload image: ${image.relativePath}`),
        );
        console.error(chalk.red(`     ${String(error)}`));
        throw new Error(`Failed to upload image ${image.relativePath}`);
      }
    }
  }

  return processedContent;
}

/**
 * Update an existing document in Outline
 */
async function updateExistingDocument(
  outlineService: OutlineService,
  parsedDoc: ParsedDocument,
  existingDocument: Document,
  includeImages: boolean,
): Promise<UploadResult> {
  let documentWasUpdated = false;

  // Move document if the document is not in the correct place
  if (
    existingDocument.parentDocumentId !== parsedDoc.parentDocumentId ||
    existingDocument.collectionId !== parsedDoc.collectionId
  ) {
    await outlineService.moveDocument(
      existingDocument.id,
      parsedDoc.collectionId,
      parsedDoc.parentDocumentId,
      parsedDoc.relativeIndex,
    );
    documentWasUpdated = true;
  }

  const parsedImages = parseRelativeImages(parsedDoc.content);
  let processedContent = transformMarkdownToAttachments(
    parsedDoc.content,
    parsedImages,
  );

  // Process images in content
  if (
    parsedImages.some((image) => !image.isExistingAttachment) ||
    includeImages
  ) {
    processedContent = await processImagesInContent(
      outlineService,
      processedContent,
      existingDocument.id,
      parsedDoc.filePath,
      parsedImages,
    );
  }

  if (existingDocument.text.trim() !== processedContent.trim()) {
    // Update the document
    const updatedDocument = await outlineService.updateDocument(
      existingDocument.id,
      {
        title: parsedDoc.metadata.title,
        text: processedContent,
      },
    );

    await writeDocumentFile(
      parsedDoc.filePath,
      updatedDocument.text,
      parsedDoc.metadata,
    );

    // Wait one second between each upload to avoid rate limiting
    if (!IS_TEST) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { status: 'updated', document: updatedDocument };
  }

  if (documentWasUpdated) {
    return { status: 'updated', document: existingDocument };
  }

  return { status: 'skipped', document: existingDocument };
}

/**
 * Create a new document in Outline
 */
async function createNewDocument(
  outlineService: OutlineService,
  parsedDoc: ParsedDocument,
  collection: DocumentCollection,
  parentDocumentId: string | undefined,
  includeImages: boolean,
): Promise<UploadResult> {
  // Create document title from metadata or filename
  const { title } = parsedDoc.metadata;

  const parsedImages = parseRelativeImages(parsedDoc.content);
  // First, transform existing attachment references back
  const processedContent = transformMarkdownToAttachments(
    parsedDoc.content,
    parsedImages,
  );

  // First create the document with placeholder content to get an ID
  const document = await outlineService.createDocument({
    title,
    text: processedContent,
    collectionId: collection.id,
    parentDocumentId,
    publish: true,
  });

  // Save the document with the new outline ID
  await writeDocumentFile(parsedDoc.filePath, document.text, {
    ...parsedDoc.metadata,
    outlineId: document.id,
  });

  // Wait one second between each upload to avoid rate limiting
  if (!IS_TEST) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (
    parsedImages.every((image) => image.isExistingAttachment) ||
    !includeImages
  ) {
    return { status: 'created', document };
  }

  try {
    // Process images with the new document ID
    const processedContent = await processImagesInContent(
      outlineService,
      parsedDoc.content,
      document.id,
      parsedDoc.filePath,
      parsedImages,
    );

    // Update the document with the final content
    const finalDocument = await outlineService.updateDocument(document.id, {
      text: processedContent,
      publish: true,
    });

    await writeDocumentFile(parsedDoc.filePath, finalDocument.text, {
      ...parsedDoc.metadata,
      outlineId: finalDocument.id,
    });

    return { status: 'created', document: finalDocument };
  } catch (error) {
    // If image processing fails, update with original content
    console.warn(
      chalk.yellow(`\n  ⚠ Failed to process images for new document`),
    );
    console.warn(chalk.yellow(`     ${String(error)}`));
    const fallbackDocument = await outlineService.updateDocument(document.id, {
      text: parsedDoc.content,
    });
    return { status: 'created', document: fallbackDocument };
  }
}
