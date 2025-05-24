import chalk from 'chalk';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';
import pLimit from 'p-limit';

import type { ImageUploadInfo } from '@src/services/attachments.js';
import type { DocumentCollection } from '@src/types/collections.js';

import { REQUEST_CONCURRENCY } from '@src/constants/concurrency.js';
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
import { directoryExists } from '../utils/file-manager.js';

const limit = pLimit(REQUEST_CONCURRENCY);

/**
 * Upload local markdown files to Outline
 */
export async function uploadCommand(
  config: Config,
  options: UploadOptions,
): Promise<void> {
  const spinner = ora('Initializing upload...').start();

  try {
    const outlineService = getOutlineService(config.outline.apiUrl);

    const sourceDir = options.source ?? config.outputDir;

    // Check if source directory exists
    if (!(await directoryExists(sourceDir))) {
      throw new Error(`Source directory does not exist: ${sourceDir}`);
    }

    spinner.text = 'Scanning for markdown files...';

    spinner.text = 'Fetching collections from Outline...';
    const allCollections = await outlineService.getCollections();
    const collectionsToProcess = getCollectionConfigs(
      allCollections,
      options.collection ? [options.collection] : [],
      config,
      sourceDir,
    );

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

    console.info(chalk.green('\n✓ Upload completed successfully!'));
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
  const spinner = ora(`Processing collection: ${collection.name}`).start();

  let uploadedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const filesToUpload = await readCollectionFiles(collection);

  await Promise.all(
    filesToUpload.map(async (file) => {
      try {
        const result = await limit(async () =>
          uploadFile(outlineService, file, collection, options, includeImages),
        );

        switch (result.status) {
          case 'created': {
            uploadedCount++;
            break;
          }
          case 'updated': {
            updatedCount++;
            break;
          }
          case 'skipped': {
            skippedCount++;
            break;
          }
        }
      } catch (error) {
        errorCount++;
        console.info(chalk.red(`  ✗ Failed: ${file.filePath}`));
        console.info(chalk.red(`     ${String(error)}`));
      }
    }),
  );

  if (errorCount > 0) {
    spinner.fail(
      `  ${collection.name}: Created ${String(uploadedCount)}, Updated ${String(updatedCount)}, Skipped ${String(skippedCount)}, Errors ${String(errorCount)}`,
    );
    return;
  }

  spinner.succeed(
    `  ${collection.name}: Created ${String(uploadedCount)}, Updated ${String(updatedCount)}, Skipped ${String(skippedCount)}, Errors ${String(errorCount)}`,
  );
}

interface UploadSkippedResult {
  status: 'skipped';
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
  if (!file.metadata.outlineId && options.updateOnly) {
    return { status: 'skipped' };
  }

  // If document has metadata, use it for upload
  return file.metadata.outlineId
    ? updateExistingDocument(outlineService, file, includeImages)
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

        // Replace the relative path with the attachment URL
        const originalPattern = `![${image.caption}](./${image.relativePath})`;
        const replacement = `![${image.caption}](${attachment.url})`;
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
  includeImages: boolean,
): Promise<UploadResult> {
  if (!parsedDoc.metadata.outlineId) {
    throw new Error(`Document ${String(parsedDoc.filePath)} has no outlineId`);
  }

  // Get the document from Outline
  const document = await outlineService.getDocument(
    parsedDoc.metadata.outlineId,
  );

  let documentWasUpdated = false;

  // Move document if the document is not in the correct place
  if (
    document.parentDocumentId !== parsedDoc.parentDocumentId ||
    document.collectionId !== parsedDoc.collectionId
  ) {
    await outlineService.moveDocument(
      parsedDoc.metadata.outlineId,
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
      parsedDoc.metadata.outlineId,
      parsedDoc.filePath,
      parsedImages,
    );
  }

  if (document.text.trim() !== processedContent.trim()) {
    // Update the document
    const updatedDocument = await outlineService.updateDocument(
      parsedDoc.metadata.outlineId,
      {
        title: parsedDoc.metadata.title,
        text: processedContent,
      },
    );

    return { status: 'updated', document: updatedDocument };
  }

  if (documentWasUpdated) {
    return { status: 'updated', document };
  }

  return { status: 'skipped' };
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

  if (
    parsedImages.some((image) => !image.isExistingAttachment) ||
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
