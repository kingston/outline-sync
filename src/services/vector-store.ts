import type { Document } from '@langchain/core/documents';

import { FaissStore } from '@langchain/community/vectorstores/faiss';
import path from 'node:path';

import type { LanguageModelConfig } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { directoryExists } from '@src/utils/file-manager.js';
import {
  constructOutlineUrl,
  createSafeFilename,
} from '@src/utils/file-names.js';

import { getLanguageEmbeddingsModel } from './langchain.js';
import { readCollectionFiles } from './output-files.js';

interface IndexedDocumentMetadata {
  title: string;
  outlineId?: string | undefined;
  urlId?: string | undefined;
  lastModifiedAt: string;
  uri: string;
  description?: string;
}

interface IndexVectorStoreForCollectionResult {
  documentsAdded: number;
  documentsDeleted: number;
}

function getCollectionIndexDirectory(
  config: LanguageModelConfig,
  collection: DocumentCollectionWithConfig,
): string {
  return path.join(config.searchIndexDirectory, 'doc-store', collection.urlId);
}

export async function indexVectorStoreForCollection(
  vectorStore: FaissStore,
  config: LanguageModelConfig,
  collection: DocumentCollectionWithConfig,
  apiUrl?: string,
): Promise<IndexVectorStoreForCollectionResult> {
  const searchIndexDirectory = getCollectionIndexDirectory(config, collection);

  const existingDocs = vectorStore.getDocstore()._docs;
  const collectionFiles = await readCollectionFiles(collection);

  const documentIdsToDelete: string[] = [];

  // Delete documents that have been removed or updated
  for (const [id, document] of existingDocs.entries()) {
    const collectionFile = collectionFiles.find(
      (file) => file.relativePath === id,
    );

    if (!collectionFile) {
      documentIdsToDelete.push(id);
    } else if (
      document.metadata.lastModifiedAt !==
      collectionFile.lastModifiedAt.toISOString()
    ) {
      documentIdsToDelete.push(id);
    }
  }

  if (documentIdsToDelete.length > 0) {
    await vectorStore.delete({ ids: documentIdsToDelete });
  }

  // Add new documents
  const documentsToAdd: Document<IndexedDocumentMetadata>[] = [];
  const documentIdsToAdd: string[] = [];
  for (const collectionFile of collectionFiles) {
    if (
      existingDocs.has(collectionFile.relativePath) &&
      !documentIdsToDelete.includes(collectionFile.relativePath)
    ) {
      continue;
    }

    documentIdsToAdd.push(collectionFile.relativePath);
    
    // Generate URI - use Outline URL if both urlId and apiUrl are available, otherwise use file-based URI
    const uri =
      collectionFile.metadata.urlId && apiUrl
        ? constructOutlineUrl(
            apiUrl,
            collectionFile.metadata.title,
            collectionFile.metadata.urlId,
          )
        : `documents://${createSafeFilename(collection.name)}/${collectionFile.relativePath}`;
    
    documentsToAdd.push({
      pageContent: collectionFile.content,
      metadata: {
        title: collectionFile.metadata.title,
        outlineId: collectionFile.metadata.outlineId,
        urlId: collectionFile.metadata.urlId,
        lastModifiedAt: collectionFile.lastModifiedAt.toISOString(),
        uri,
      },
    });
  }

  await vectorStore.addDocuments(documentsToAdd, { ids: documentIdsToAdd });

  await vectorStore.save(searchIndexDirectory);
  return {
    documentsAdded: documentsToAdd.length,
    documentsDeleted: documentIdsToDelete.length,
  };
}

export async function createVectorStore(
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

export async function createIndexedVectorStoreFromCollections(
  config: LanguageModelConfig,
  collections: DocumentCollectionWithConfig[],
  { showLogs = false, apiUrl }: { showLogs?: boolean; apiUrl?: string } = {},
): Promise<FaissStore[]> {
  const vectorStores: FaissStore[] = [];
  for (const collection of collections) {
    const vectorStore = await createVectorStore(config, collection);
    const result = await indexVectorStoreForCollection(
      vectorStore,
      config,
      collection,
      apiUrl,
    );
    if (
      (result.documentsAdded > 0 || result.documentsDeleted > 0) &&
      showLogs
    ) {
      console.info(
        `Indexed ${result.documentsAdded.toString()} documents and deleted ${result.documentsDeleted.toString()} documents for collection ${collection.name}`,
      );
    }
    vectorStores.push(vectorStore);
  }

  return vectorStores;
}

interface SearchVectorStoreOptions {
  includeDocumentContents?: boolean;
  limit?: number;
}

interface SearchVectorStoreResult {
  results: {
    uri: string;
    title: string;
    description: string;
    content?: string;
    score: number;
  }[];
}

export async function searchVectorStore(
  vectorStore: FaissStore,
  query: string,
  options: SearchVectorStoreOptions = {},
): Promise<SearchVectorStoreResult> {
  const { includeDocumentContents = false, limit = 5 } = options;

  const results = (await vectorStore.similaritySearchWithScore(
    query,
    limit,
  )) as [Document<IndexedDocumentMetadata>, number][];

  return {
    results: results.map(([result, score]) => ({
      uri: result.metadata.uri,
      title: result.metadata.title,
      description: result.metadata.description ?? '',
      content: includeDocumentContents ? result.pageContent : undefined,
      score,
    })),
  };
}

export async function searchVectorStores(
  vectorStores: FaissStore[],
  query: string,
  options: SearchVectorStoreOptions = {},
): Promise<SearchVectorStoreResult> {
  const results = await Promise.all(
    vectorStores.map((vectorStore) =>
      searchVectorStore(vectorStore, query, options),
    ),
  );

  // Combine and sort all results by score
  const allResults = results.flatMap((result) => result.results);
  allResults.sort((a, b) => a.score - b.score);

  // Return top results within limit
  return {
    results: allResults.slice(0, options.limit ?? 5),
  };
}
