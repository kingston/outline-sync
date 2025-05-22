import chalk from 'chalk';
import ora from 'ora';
import pLimit from 'p-limit';

import type { DocumentCollection } from '@src/types/collections.js';

import { readCollectionFiles } from '@src/services/output-files.js';

import type { OutlineService } from '../services/outline.js';
import type { Config, UploadOptions } from '../types/config.js';
import type { Document, ParsedDocument } from '../types/documents.js';
import type { DocumentCollectionWithConfig } from '../utils/collection-filter.js';

import { getOutlineService } from '../services/outline.js';
import { getCollectionConfigs } from '../utils/collection-filter.js';
import { directoryExists } from '../utils/file-manager.js';

const limit = pLimit(10);

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
      await processCollectionFiles(outlineService, collection, options);
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
          uploadFile(outlineService, file, collection, options),
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
        console.info(
          chalk.red(`  ✗ Failed: ${file.filePath} - ${String(error)}`),
        );
      }
    }),
  );

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
): Promise<UploadResult> {
  if (!file.metadata.outlineId && options.updateOnly) {
    return { status: 'skipped' };
  }

  // If document has metadata, use it for upload
  return file.metadata.outlineId
    ? updateExistingDocument(outlineService, file)
    : createNewDocument(
        outlineService,
        file,
        collection,
        file.parentDocumentId,
      );
}

/**
 * Update an existing document in Outline
 */
async function updateExistingDocument(
  outlineService: OutlineService,
  parsedDoc: ParsedDocument,
): Promise<UploadResult> {
  if (!parsedDoc.metadata.outlineId) {
    throw new Error(`Document ${String(parsedDoc.filePath)} has no outlineId`);
  }

  // Get the document from Outline
  const document = await outlineService.getDocument(
    parsedDoc.metadata.outlineId,
  );

  if (document.text.trim() === parsedDoc.content.trim()) {
    return { status: 'skipped' };
  }

  // Update the document
  const updatedDocument = await outlineService.updateDocument(
    parsedDoc.metadata.outlineId,
    {
      title: parsedDoc.metadata.title,
      text: parsedDoc.content,
    },
  );

  return { status: 'updated', document: updatedDocument };
}

/**
 * Create a new document in Outline
 */
async function createNewDocument(
  outlineService: OutlineService,
  parsedDoc: ParsedDocument,
  collection: DocumentCollection,
  parentDocumentId: string | undefined,
): Promise<UploadResult> {
  // Create document title from metadata or filename
  const { title } = parsedDoc.metadata;

  // Create the document
  const document = await outlineService.createDocument({
    title,
    text: parsedDoc.content,
    collectionId: collection.id,
    parentDocumentId,
    publish: true,
  });

  return { status: 'created', document };
}
