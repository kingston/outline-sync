import pLimit from 'p-limit';

import type { Document, DocumentWithChildren } from '@src/types/documents.js';

import { REQUEST_CONCURRENCY } from '@src/constants/concurrency.js';

import type {
  DocumentCollectionDocumentNode,
  OutlineService,
} from './outline.js';

// limit the number of concurrent requests
const limit = pLimit(REQUEST_CONCURRENCY);

/**
 * Fetch a document from Outline limiting the number of concurrent requests
 */
async function fetchDocument(
  outlineService: OutlineService,
  documentId: string,
): Promise<Document | undefined> {
  return limit(async () => outlineService.getDocument(documentId));
}

async function buildDocumentHierarchy(
  outlineService: OutlineService,
  documentStructure: DocumentCollectionDocumentNode[],
): Promise<DocumentWithChildren[]> {
  return Promise.all(
    documentStructure.map(async (node) => {
      const document = await fetchDocument(outlineService, node.id);
      if (!document) {
        throw new Error(`Document ${node.id} not found`);
      }
      const children = await buildDocumentHierarchy(
        outlineService,
        node.children,
      );
      return { ...document, children };
    }),
  );
}

/**
 * Get all documents for a collection
 */
export async function getDocumentsForCollection(
  outlineService: OutlineService,
  collectionId: string,
): Promise<DocumentWithChildren[]> {
  const documentStructure =
    await outlineService.getDocumentCollectionStructure(collectionId);
  return buildDocumentHierarchy(outlineService, documentStructure);
}
