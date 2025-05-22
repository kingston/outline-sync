import chalk from 'chalk';
import path from 'node:path';
import ora from 'ora';

import type { DocumentCollection } from '@src/types/collections.js';

import type { OutlineService } from '../services/outline.js';
import type { Config, UploadOptions } from '../types/config.js';
import type { Document, ParsedDocument } from '../types/documents.js';

import { getOutlineService } from '../services/outline.js';
import { getCollectionConfigs } from '../utils/collection-filter.js';
import {
  directoryExists,
  getMarkdownFiles,
  readDocumentFile,
} from '../utils/file-manager.js';
import {
  findParentDocumentId,
  moveFileToCorrectLocation,
  shouldMoveFile,
} from '../utils/parent-resolver.js';

/**
 * Upload local markdown files to Outline
 */
export async function uploadCommand(
  config: Config,
  options: UploadOptions,
  paths: string[] = [],
  collectionNames: string[] = [],
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

    // Get all markdown files
    const filesToUpload =
      paths.length > 0
        ? paths.filter((path) => path.endsWith('.md'))
        : await getMarkdownFiles(sourceDir);

    if (filesToUpload.length === 0) {
      spinner.warn('No markdown files found to upload');
      return;
    }

    spinner.text = 'Fetching collections from Outline...';
    const allCollections = await outlineService.getCollections();
    const collectionsToProcess = getCollectionConfigs(
      allCollections,
      collectionNames,
      config,
      sourceDir,
    );

    if (collectionsToProcess.length === 0) {
      spinner.fail('No collections found to process');
      return;
    }

    spinner.succeed(
      `Found ${filesToUpload.length.toString()} file(s) to upload across ${collectionsToProcess.length.toString()} collection(s)`,
    );

    // Process each collection individually
    for (const collection of collectionsToProcess) {
      await processCollectionFiles(
        outlineService,
        collection,
        filesToUpload,
        allCollections,
        options,
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
  collection: DocumentCollection,
  filesToUpload: string[],
  allCollections: DocumentCollection[],
  options: UploadOptions,
): Promise<void> {
  console.info(chalk.cyan(`\nProcessing collection: ${collection.name}`));

  let uploadedCount = 0;
  let updatedCount = 0;
  let movedCount = 0;
  let errorCount = 0;

  for (const filePath of filesToUpload) {
    try {
      // Find parent document ID and collection information
      const parentInfo = await findParentDocumentId(filePath, allCollections);

      // Check if file should be moved
      const moveInfo = await shouldMoveFile(
        filePath,
        parentInfo.parentDocumentId,
        parentInfo.collectionId,
        allCollections,
      );

      let actualFilePath = filePath;
      if (moveInfo.shouldMove && moveInfo.targetPath) {
        await moveFileToCorrectLocation(filePath, moveInfo.targetPath);
        actualFilePath = moveInfo.targetPath;
        movedCount++;
        console.info(
          chalk.yellow(
            `  → Moved: ${path.basename(filePath)} to correct location`,
          ),
        );
      }

      const result = await uploadFile(
        outlineService,
        actualFilePath,
        collection,
        parentInfo.parentDocumentId,
        options,
      );

      switch (result.status) {
        case 'created': {
          uploadedCount++;
          console.info(chalk.green(`  ✓ Created: ${result.document.title}`));
          break;
        }
        case 'updated': {
          updatedCount++;
          console.info(chalk.blue(`  ↑ Updated: ${result.document.title}`));
          break;
        }
        case 'skipped': {
          console.info(
            chalk.gray(`  ⤷ Skipped: ${path.basename(actualFilePath)}`),
          );
          break;
        }
      }
    } catch (error) {
      errorCount++;
      console.info(
        chalk.red(`  ✗ Failed: ${path.basename(filePath)} - ${String(error)}`),
      );
    }
  }

  // Collection summary
  console.info(
    chalk.gray(
      `  ${collection.name}: Created ${String(uploadedCount)}, Updated ${String(updatedCount)}, Moved ${String(movedCount)}, Errors ${String(errorCount)}`,
    ),
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
  filePath: string,
  collection: DocumentCollection,
  parentDocumentId: string | undefined,
  options: UploadOptions,
): Promise<UploadResult> {
  // Read and parse the document
  const parsedDoc = await readDocumentFile(filePath);

  if (!parsedDoc.metadata.outlineId && options.updateOnly) {
    return { status: 'skipped' };
  }

  // If document has metadata, use it for upload
  return parsedDoc.metadata.outlineId
    ? updateExistingDocument(outlineService, parsedDoc)
    : createNewDocument(
        outlineService,
        parsedDoc,
        collection,
        parentDocumentId,
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

  // Update the document
  const document = await outlineService.updateDocument(
    parsedDoc.metadata.outlineId,
    {
      title: parsedDoc.metadata.title,
      text: parsedDoc.content,
    },
  );

  return { status: 'updated', document };
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
