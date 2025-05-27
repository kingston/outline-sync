import type { Document } from '@langchain/core/documents';

import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import path from 'node:path';

import type { LanguageModelConfig } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { directoryExists } from '@src/utils/file-manager.js';
import { createSafeFilename } from '@src/utils/file-names.js';

import { getLanguageEmbeddingsModel } from './langchain.js';
import { readCollectionFiles } from './output-files.js';

interface IndexedDocumentMetadata {
  lastModifiedAt: string;
  documentRelativePath: string;
  documentUri: string;
  loc?: { lines?: { from: number; to: number } };
}

interface IndexRagStoreForCollectionResult {
  documentsAdded: number;
  documentsDeleted: number;
}

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 80;

function getCollectionIndexDirectory(
  config: LanguageModelConfig,
  collection: DocumentCollectionWithConfig,
): string {
  return path.join(config.searchIndexDirectory, 'rag-store', collection.urlId);
}

export async function indexRagStoreForCollection(
  vectorStore: FaissStore,
  config: LanguageModelConfig,
  collection: DocumentCollectionWithConfig,
): Promise<IndexRagStoreForCollectionResult> {
  const searchIndexDirectory = getCollectionIndexDirectory(config, collection);

  const existingDocs = vectorStore.getDocstore()._docs;
  const collectionFiles = await readCollectionFiles(collection);

  const existingDocumentRelativePaths = new Set<string>();
  const chunkIdsToDelete: string[] = [];

  // Delete documents that have been removed or updated
  for (const [id, document] of existingDocs.entries()) {
    const { documentRelativePath } =
      document.metadata as IndexedDocumentMetadata;
    const collectionFile = collectionFiles.find(
      (file) => file.relativePath === documentRelativePath,
    );

    if (!collectionFile) {
      chunkIdsToDelete.push(id);
    } else if (
      document.metadata.lastModifiedAt ===
      collectionFile.lastModifiedAt.toISOString()
    ) {
      existingDocumentRelativePaths.add(documentRelativePath);
    } else {
      chunkIdsToDelete.push(id);
    }
  }

  if (chunkIdsToDelete.length > 0) {
    await vectorStore.delete({ ids: chunkIdsToDelete });
  }

  // Add new documents
  const documentsToAdd: Document<IndexedDocumentMetadata>[] = [];
  for (const collectionFile of collectionFiles) {
    if (existingDocumentRelativePaths.has(collectionFile.relativePath)) {
      continue;
    }
    if (collectionFile.content.trim().length === 0) {
      continue;
    }
    documentsToAdd.push({
      pageContent: collectionFile.content,
      metadata: {
        lastModifiedAt: collectionFile.lastModifiedAt.toISOString(),
        documentRelativePath: collectionFile.relativePath,
        documentUri: `documents://${createSafeFilename(collection.name)}/${collectionFile.relativePath}`,
      },
    });
  }
  const mdSplitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const chunks = await mdSplitter.splitDocuments(documentsToAdd);

  await vectorStore.addDocuments(chunks);

  await vectorStore.save(searchIndexDirectory);
  return {
    documentsAdded: documentsToAdd.length,
    documentsDeleted: chunkIdsToDelete.length,
  };
}

export async function createRagStore(
  config: LanguageModelConfig,
  collection: DocumentCollectionWithConfig,
): Promise<FaissStore> {
  const embeddings = await getLanguageEmbeddingsModel(config);
  const searchIndexDirectory = getCollectionIndexDirectory(config, collection);
  const searchIndexExists = await directoryExists(searchIndexDirectory);
  const store = searchIndexExists
    ? FaissStore.load(searchIndexDirectory, embeddings)
    : FaissStore.fromDocuments([], embeddings);

  return store;
}

export async function createIndexedRagStoreFromCollections(
  config: LanguageModelConfig,
  collections: DocumentCollectionWithConfig[],
): Promise<FaissStore[]> {
  const vectorStores: FaissStore[] = [];
  for (const collection of collections) {
    const vectorStore = await createRagStore(config, collection);
    const result = await indexRagStoreForCollection(
      vectorStore,
      config,
      collection,
    );
    if (result.documentsAdded > 0 || result.documentsDeleted > 0) {
      console.info(
        `Indexed ${result.documentsAdded.toString()} documents and deleted ${result.documentsDeleted.toString()} documents for collection ${collection.name}`,
      );
    }
    vectorStores.push(vectorStore);
  }

  return vectorStores;
}

interface SearchRagStoreOptions {
  includeDocumentContents?: boolean;
  limit?: number;
}

interface SearchRagStoreResult {
  results: {
    documentUri: string;
    content: string;
    score: number;
    loc?: { lines?: { from: number; to: number } };
  }[];
}

export async function searchRagStore(
  vectorStore: FaissStore,
  query: string,
  options: SearchRagStoreOptions = {},
): Promise<SearchRagStoreResult> {
  const { limit = 10 } = options;

  const results = (await vectorStore.similaritySearchWithScore(
    query,
    limit,
  )) as [Document<IndexedDocumentMetadata>, number][];

  return {
    results: results.map(([result, score]) => ({
      documentUri: result.metadata.documentUri,
      content: result.pageContent,
      score,
      loc: result.metadata.loc,
    })),
  };
}

export async function searchRagStores(
  vectorStores: FaissStore[],
  query: string,
  options: SearchRagStoreOptions = {},
): Promise<SearchRagStoreResult> {
  const results = await Promise.all(
    vectorStores.map((vectorStore) =>
      searchRagStore(vectorStore, query, options),
    ),
  );

  // Combine and sort all results by score
  const allResults = results.flatMap((result) => result.results);
  allResults.sort((a, b) => a.score - b.score);

  // Return top results within limit
  return {
    results: allResults.slice(0, options.limit ?? 10),
  };
}
