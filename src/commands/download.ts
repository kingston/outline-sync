import chalk from 'chalk';
import path from 'node:path';
import ora from 'ora';

import type { DocumentCollection } from '@src/types/collections.js';

import type { OutlineService } from '../services/outline.js';
import type { Config, DownloadOptions } from '../types/config.js';
import type {
  DocumentFrontmatter,
  DocumentHierarchy,
  DocumentWithOrder,
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
    const documents = await outlineService.getDocumentsForCollection(
      collection.id,
    );

    // Build document hierarchy
    const hierarchy = buildDocumentHierarchy(documents);

    const collectionDir = collection.outputDirectory;

    // Download documents
    let downloadedCount = 0;
    for (const doc of hierarchy) {
      await downloadDocumentRecursive({
        outlineService,
        hierarchyDoc: doc,
        collection,
        outputDir: collectionDir,
        includeMetadata,
      });
      downloadedCount++;
    }

    spinner.succeed(
      `Downloaded ${String(downloadedCount)} document(s) from ${collection.name}`,
    );
  } catch (error) {
    spinner.fail(`Failed to download collection: ${collection.name}`);
    throw error;
  }
}

/**
 * Build a hierarchical structure of documents
 */
function buildDocumentHierarchy(
  documents: DocumentWithOrder[],
): DocumentHierarchy[] {
  const documentMap = new Map<string, DocumentHierarchy>();
  const rootDocuments: DocumentHierarchy[] = [];

  // First pass: create all document entries
  for (const doc of documents) {
    documentMap.set(doc.id, {
      id: doc.id,
      title: doc.title,
      parentId: doc.parentDocumentId,
      children: [],
      document: doc,
    });
  }

  // Second pass: build hierarchy
  for (const doc of documents) {
    if (!doc.id) continue;
    const hierarchyDoc = documentMap.get(doc.id);
    if (!hierarchyDoc) continue;

    if (doc.parentDocumentId) {
      const parent = documentMap.get(doc.parentDocumentId);
      if (parent) {
        parent.children.push(hierarchyDoc);
      } else {
        // Parent not found, treat as root
        rootDocuments.push(hierarchyDoc);
      }
    } else {
      rootDocuments.push(hierarchyDoc);
    }
  }

  return rootDocuments;
}

/**
 * Download a document and its children recursively
 */
async function downloadDocumentRecursive({
  outlineService,
  hierarchyDoc,
  collection,
  outputDir,
  includeMetadata,
}: {
  outlineService: OutlineService;
  hierarchyDoc: DocumentHierarchy;
  collection: DocumentCollection;
  outputDir: string;
  includeMetadata: boolean;
}): Promise<void> {
  // Get full document details
  const { document } = hierarchyDoc;

  // Determine file path based on whether it has children
  const newParentPath = path.join(
    outputDir,
    createSafeFilename(document.title),
  );
  const filePath =
    hierarchyDoc.children.length > 0
      ? path.join(newParentPath, 'index.md')
      : path.join(outputDir, createSafeMarkdownFilename(document.title));

  // Create metadata if enabled
  const metadata: DocumentFrontmatter | undefined = includeMetadata
    ? {
        title: document.title,
        description: document.description,
        outlineId: document.id,
        sidebar: {
          order: document.order,
        },
      }
    : undefined;

  // Write document file
  await writeDocumentFile(filePath, document.text, metadata);

  console.info(chalk.gray(`  ↓ ${document.title}`));

  // Download children
  for (const child of hierarchyDoc.children) {
    await downloadDocumentRecursive({
      outlineService,
      hierarchyDoc: child,
      collection,
      outputDir,
      includeMetadata,
    });
  }
}
