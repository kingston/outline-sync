import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';

import type { DocumentCollection } from '@src/types/collections.js';

import {
  parseAttachments,
  transformMarkdownImages,
} from '@src/services/attachments.js';
import { getDocumentsForCollection } from '@src/services/documents.js';
import {
  cleanupUnwrittenFiles,
  readCollectionFiles,
} from '@src/services/output-files.js';

import type { OutlineService } from '../services/outline.js';
import type { Config, DownloadOptions } from '../types/config.js';
import type {
  DocumentFrontmatter,
  DocumentWithChildren,
} from '../types/documents.js';
import type { DocumentCollectionWithConfig } from '../utils/collection-filter.js';

import { getOutlineService } from '../services/outline.js';
import { getCollectionConfigs } from '../utils/collection-filter.js';
import { writeDocumentFile } from '../utils/file-manager.js';
import {
  createSafeFilename,
  createSafeMarkdownFilename,
} from '../utils/file-names.js';

/**
 * Download collections and documents from Outline
 */
export async function downloadCommand(
  config: Config,
  options: DownloadOptions,
): Promise<void> {
  const spinner = ora({
    hideCursor: false,
    text: 'Initializing download...',
  }).start();

  try {
    const outlineService = getOutlineService(config.outline.apiUrl);

    const includeMetadata = !config.behavior.skipMetadata;
    const { cleanupAfterDownload, includeImages } = config.behavior;

    spinner.text = 'Fetching collections...';
    const allCollections = await outlineService.getCollections();
    const collectionsToDownload = getCollectionConfigs(allCollections, config, {
      collectionUrlIdsFilter: options.collections,
      outputDir: options.dir,
    });

    if (collectionsToDownload.length === 0) {
      spinner.fail('No collections found to download');
      return;
    }

    spinner.succeed(
      `Found ${collectionsToDownload.length.toString()} collection(s) to download`,
    );

    // Download each collection
    for (const collection of collectionsToDownload) {
      await downloadCollection(
        outlineService,
        collection,
        includeMetadata,
        cleanupAfterDownload,
        includeImages,
      );
    }

    if (process.env.NODE_ENV !== 'test') {
      console.info(chalk.green('✓ Download completed successfully!'));
    }
  } catch (error) {
    spinner.fail('Download failed');
    throw error;
  }
}

/**
 * Download a single collection and its documents
 */
async function downloadCollection(
  outlineService: OutlineService,
  collection: DocumentCollectionWithConfig,
  includeMetadata: boolean,
  cleanupAfterDownload: boolean,
  includeImages: boolean,
): Promise<void> {
  const spinner = ora({
    hideCursor: false,
    text: `Downloading collection: ${collection.name}`,
  }).start();

  try {
    // Index existing files to preserve descriptions
    const existingDocsIndex = new Map<string, DocumentFrontmatter>();
    try {
      const existingDocs = await readCollectionFiles(collection);

      // Extract just the metadata for each document
      for (const doc of existingDocs) {
        if (doc.metadata.outlineId) {
          existingDocsIndex.set(doc.metadata.outlineId, doc.metadata);
        }
      }
    } catch {
      // No existing files or error reading them
    }

    const documents = await getDocumentsForCollection(
      outlineService,
      collection.id,
    );
    const collectionDir = collection.outputDirectory;

    // Download documents
    let downloadedCount = 0;
    const writtenPaths = new Set<string>();
    const orderCounter = { lastOrder: 1 };

    for (const doc of documents) {
      const { written } = await writeDocumentRecursive({
        hierarchyDoc: doc,
        collection,
        outputDir: collectionDir,
        includeMetadata,
        includeImages,
        orderCounter,
        existingDocsIndex,
        writtenPaths,
        outlineService,
      });
      downloadedCount += written;
    }

    // Clean up files that weren't written
    if (cleanupAfterDownload && writtenPaths.size > 0) {
      const deletedCount = await cleanupUnwrittenFiles(
        collectionDir,
        writtenPaths,
      );
      if (deletedCount > 0) {
        spinner.text = `Cleaned up ${deletedCount.toString()} unused file(s) from ${collection.name}`;
      }
    }

    spinner.succeed(
      `Downloaded ${downloadedCount.toString()} document(s) from ${collection.name}`,
    );
  } catch (error) {
    spinner.fail(`Failed to download collection: ${collection.name}`);
    throw error;
  }
}

/**
 * Write a document and its children recursively
 */
async function writeDocumentRecursive({
  hierarchyDoc,
  collection,
  outputDir,
  includeMetadata,
  includeImages,
  orderCounter,
  existingDocsIndex,
  writtenPaths,
  outlineService,
}: {
  hierarchyDoc: DocumentWithChildren;
  collection: DocumentCollection;
  outputDir: string;
  includeMetadata: boolean;
  includeImages: boolean;
  orderCounter: { lastOrder: number };
  existingDocsIndex: Map<string, DocumentFrontmatter>;
  writtenPaths: Set<string>;
  outlineService: OutlineService;
}): Promise<{ written: number }> {
  // Determine file path based on whether it has children
  const newParentPath = path.join(
    outputDir,
    createSafeFilename(hierarchyDoc.title),
  );
  const filePath =
    hierarchyDoc.children.length > 0
      ? path.join(newParentPath, 'index.md')
      : path.join(outputDir, createSafeMarkdownFilename(hierarchyDoc.title));

  // Create metadata if enabled
  let metadata: DocumentFrontmatter | undefined;
  if (includeMetadata) {
    // Check if we have existing metadata for this document
    const existingMetadata = existingDocsIndex.get(hierarchyDoc.id);

    metadata = {
      title: hierarchyDoc.title,
      // Preserve description from existing file if not present in Outline
      description: hierarchyDoc.description ?? existingMetadata?.description,
      outlineId: hierarchyDoc.id,
      sidebar: {
        order: orderCounter.lastOrder,
      },
    };
  }

  // Process images if enabled
  let documentContent = hierarchyDoc.text;
  if (includeImages) {
    const attachments = parseAttachments(documentContent);

    const imageDir = path.join(path.dirname(filePath), 'images');
    let imageFiles: string[] = [];
    if (attachments.length > 0) {
      await fs.mkdir(imageDir, { recursive: true });
      imageFiles = await fs.readdir(imageDir);
    }

    // Download each attachment
    const attachmentsWithPaths = await Promise.all(
      attachments.map(async (attachment) => {
        // Check if the attachment already exists
        const existingAttachment = imageFiles.find((file) =>
          file.startsWith(attachment.id),
        );
        let filePath: string;
        // Don't download the attachment if it already exists
        if (existingAttachment) {
          filePath = path.join(imageDir, existingAttachment);
          writtenPaths.add(filePath);
        } else {
          filePath = await outlineService.downloadAttachmentToDirectory(
            attachment.id,
            imageDir,
          );
        }

        writtenPaths.add(filePath);

        return { ...attachment, localPath: filePath };
      }),
    );

    // Transform markdown to use local paths
    documentContent = transformMarkdownImages(
      documentContent,
      attachmentsWithPaths,
      path.dirname(filePath),
    );

    // Add image directory to written paths
    if (attachments.length > 0) {
      writtenPaths.add(imageDir);
    }
  }

  // Write document file
  await writeDocumentFile(filePath, documentContent, metadata);
  writtenPaths.add(filePath);

  // Add parent directory to written paths if it's a nested document
  if (hierarchyDoc.children.length > 0) {
    writtenPaths.add(newParentPath);
  }

  orderCounter.lastOrder += 1;

  // Write children
  let writtenCount = 1;
  for (const child of hierarchyDoc.children) {
    const { written } = await writeDocumentRecursive({
      hierarchyDoc: child,
      collection,
      outputDir: newParentPath,
      includeMetadata,
      includeImages,
      orderCounter,
      existingDocsIndex,
      writtenPaths,
      outlineService,
    });
    writtenCount += written;
  }

  return { written: writtenCount };
}
