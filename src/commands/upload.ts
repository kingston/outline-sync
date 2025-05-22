import chalk from 'chalk';
import ora from 'ora';

import type { DocumentCollection } from '@src/types/collections.js';

import type { OutlineService } from '../services/outline.js';
import type { Config, UploadOptions } from '../types/config.js';
import type { Document, ParsedDocument } from '../types/documents.js';

import { getOutlineService } from '../services/outline.js';
import {
  directoryExists,
  getMarkdownFiles,
  readDocumentFile,
} from '../utils/file-manager.js';

/**
 * Upload local markdown files to Outline
 */
export async function uploadCommand(
  config: Config,
  options: UploadOptions,
  paths: string[] = [],
): Promise<void> {
  const spinner = ora('Initializing upload...').start();

  try {
    const outlineService = getOutlineService(config.outline.apiUrl);

    const sourceDir = options.source ?? config.directories.upload;

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
    const collections = await outlineService.getCollections();

    spinner.succeed(
      `Found ${filesToUpload.length.toString()} file(s) to upload`,
    );

    // Process each file
    let uploadedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const filePath of filesToUpload) {
      try {
        const result = await uploadFile(
          outlineService,
          filePath,
          collections,
          options,
        );

        if (result.status === 'created') {
          uploadedCount++;
          console.info(chalk.green(`  ✓ Created: ${result.document.title}`));
        } else if (result.status === 'updated') {
          updatedCount++;
          console.info(chalk.blue(`  ↑ Updated: ${result.document.title}`));
        }
      } catch (error) {
        errorCount++;
        console.info(
          chalk.red(`  ✗ Failed: ${String(filePath)} - ${String(error)}`),
        );
      }
    }

    // Summary
    console.info(
      chalk.green(
        `\n✓ Upload completed! Created: ${String(uploadedCount)}, Updated: ${String(updatedCount)}, Errors: ${String(errorCount)}`,
      ),
    );
  } catch (error) {
    spinner.fail('Upload failed');
    throw error;
  }
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
