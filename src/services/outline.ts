import createClient from 'openapi-fetch';

import type { DocumentCollection } from '@src/types/collections.js';
import type { Document, DocumentWithOrder } from '@src/types/documents.js';

import type { paths } from './generated/outline-openapi.d.js';

/**
 * Create an Outline API client with the given configuration
 */
export function createOutlineClient(
  apiToken: string,
  apiUrl: string,
): ReturnType<typeof createClient<paths>> {
  return createClient<paths>({
    baseUrl: apiUrl,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });
}

// TODO: Add support for pagination

/**
 * Outline API service with typed methods
 */
export class OutlineService {
  private client: ReturnType<typeof createOutlineClient>;

  constructor(apiToken: string, apiUrl: string) {
    this.client = createOutlineClient(apiToken, apiUrl);
  }

  /**
   * Get all collections accessible to the user
   */
  async getCollections(): Promise<DocumentCollection[]> {
    const { data, error } = await this.client.POST('/collections.list', {
      body: {
        limit: 100,
        offset: 0,
        sort: 'title',
        direction: 'ASC',
      },
    });
    if (error) {
      throw new Error(`Failed to fetch collections: ${error.error}`);
    }
    return data.data
      .filter((c) => !c.archivedAt)
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
      }));
  }

  /**
   * Get documents in a specific collection
   */
  async getDocumentsForCollection(
    collectionId: string,
  ): Promise<DocumentWithOrder[]> {
    const { data, error } = await this.client.POST('/documents.list', {
      body: {
        collectionId,
        offset: 0,
        limit: 100,
        sort: 'index',
        direction: 'ASC',
      },
    });
    if (error) {
      throw new Error(`Failed to fetch collection documents: ${error.error}`);
    }
    return data.data
      .filter((d) => !d.archivedAt)
      .map((document, idx) => ({
        id: document.id,
        title: document.title,
        collectionId: document.collectionId,
        parentDocumentId: document.parentDocumentId,
        text: document.text,
        order: idx,
      }));
  }

  /**
   * Create a new document
   */
  async createDocument(params: {
    title: string;
    text: string;
    collectionId: string;
    parentDocumentId?: string;
    publish?: boolean;
  }): Promise<Document> {
    const { data, error } = await this.client.POST('/documents.create', {
      body: params,
    });
    if (error) {
      throw new Error(`Failed to create document: ${error.error}`);
    }
    return data.data;
  }

  /**
   * Update an existing document
   */
  async updateDocument(
    documentId: string,
    params: {
      title?: string;
      text?: string;
    },
  ): Promise<Document> {
    const { data, error } = await this.client.POST('/documents.update', {
      body: { id: documentId, ...params },
    });
    if (error) {
      throw new Error(`Failed to update document: ${error.error}`);
    }
    return data.data;
  }
}

export function getOutlineService(apiUrl: string): OutlineService {
  const apiToken = process.env.OUTLINE_API_TOKEN;
  if (!apiToken) {
    throw new Error('OUTLINE_API_TOKEN is not set');
  }
  return new OutlineService(apiToken, apiUrl);
}
