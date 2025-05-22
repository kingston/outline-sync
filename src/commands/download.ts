import chalk from 'chalk';
import path from 'node:path';
import ora from 'ora';

import type { DocumentCollection } from '@src/types/collections.js';

import { getDocumentsForCollection } from '@src/services/documents.js';

import type { OutlineService } from '../services/outline.js';
import type { Config, DownloadOptions } from '../types/config.js';
import type {
  DocumentFrontmatter,
  DocumentWithChildren,
} from '../types/documents.js';
import type { DocumentCollectionWithConfig } from '../utils/collection-filter.js';

import { getOutlineService } from '../services/outline.js';
import { getCollectionConfigs } from '../utils/collection-filter.js';
import {
  createSafeFilename,
  createSafeMarkdownFilename,
  writeDocumentFile,
} from '../utils/file-manager.js';

/**
 * Download collections and documents from Outline
 */
export async function downloadCommand(
  config: Config,
  options: DownloadOptions,
  collectionNames: string[] = [],
): Promise<void> {
  const spinner = ora('Initializing download...').start();

  try {
    const outlineService = getOutlineService(config.outline.apiUrl);

    const outputDir = options.dir ?? config.outputDir;
    const includeMetadata = !config.behavior.skipMetadata;

    spinner.text = 'Fetching collections...';
    const allCollections = await outlineService.getCollections();
    const collectionsToDownload = getCollectionConfigs(
      allCollections,
      collectionNames,
      config,
      outputDir,
    );

    if (collectionsToDownload.length === 0) {
      spinner.fail('No collections found to download');
      return;
    }

    spinner.succeed(
      `Found ${collectionsToDownload.length.toString()} collection(s) to download`,
    );

    // Download each collection
    for (const collection of collectionsToDownload) {
      await downloadCollection(outlineService, collection, includeMetadata);
    }

    console.info(chalk.green('✓ Download completed successfully!'));
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
): Promise<void> {
  const spinner = ora(`Downloading collection: ${collection.name}`).start();

  try {
    const documents = await getDocumentsForCollection(
      outlineService,
      collection.id,
    );
    const collectionDir = collection.outputDirectory;

    // Download documents
    let downloadedCount = 0;
    const orderCounter = { lastOrder: 1 };
    for (const doc of documents) {
      const { written } = await writeDocumentRecursive({
        hierarchyDoc: doc,
        collection,
        outputDir: collectionDir,
        includeMetadata,
        orderCounter,
      });
      downloadedCount += written;
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
  orderCounter,
}: {
  hierarchyDoc: DocumentWithChildren;
  collection: DocumentCollection;
  outputDir: string;
  includeMetadata: boolean;
  orderCounter: { lastOrder: number };
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
  const metadata: DocumentFrontmatter | undefined = includeMetadata
    ? {
        title: hierarchyDoc.title,
        description: hierarchyDoc.description,
        outlineId: hierarchyDoc.id,
        sidebar: {
          order: orderCounter.lastOrder,
        },
      }
    : undefined;

  // Write document file
  await writeDocumentFile(filePath, hierarchyDoc.text, metadata);

  orderCounter.lastOrder += 1;

  // Write children
  let writtenCount = 1;
  for (const child of hierarchyDoc.children) {
    const { written } = await writeDocumentRecursive({
      hierarchyDoc: child,
      collection,
      outputDir: newParentPath,
      includeMetadata,
      orderCounter,
    });
    writtenCount += written;
  }

  return { written: writtenCount };
}
