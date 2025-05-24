import mime, { extension } from 'mime-types';
import fs from 'node:fs/promises';
import path from 'node:path';
import createClient from 'openapi-fetch';

import type { DocumentCollection } from '@src/types/collections.js';
import type { Document, DocumentWithOrder } from '@src/types/documents.js';

import { downloadFile, uploadFile } from '@src/utils/file-transfer.js';

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

export interface DocumentCollectionDocumentNode {
  id: string;
  title: string;
  url: string;
  children: DocumentCollectionDocumentNode[];
}

export interface DocumentAttachment {
  url: string;
  name: string;
  contentType: string;
  size: number;
}

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
        urlId: collection.urlId,
        name: collection.name,
        description: collection.description,
      }));
  }

  /**
   * Get the structure of a document collection
   */
  async getDocumentCollectionStructure(
    collectionId: string,
  ): Promise<DocumentCollectionDocumentNode[]> {
    const { data, error } = await this.client.POST('/collections.documents', {
      body: { id: collectionId },
    });
    if (error) {
      throw new Error(`Failed to fetch collection documents: ${error.error}`);
    }
    return data.data;
  }

  /**
   * Get a document by its ID
   */
  async getDocument(documentId: string): Promise<Document | undefined> {
    const { data, error } = await this.client.POST('/documents.info', {
      body: { id: documentId, shareId: undefined as unknown as string },
    });
    if (error) {
      if (error.error === 'not_found') {
        return undefined;
      }
      throw new Error(`Failed to fetch document: ${error.error}`);
    }
    return {
      id: data.data.id,
      title: data.data.title,
      collectionId: data.data.collectionId,
      text: data.data.text,
      parentDocumentId:
        (data.data.parentDocumentId as string | null) ?? undefined,
    };
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
      publish?: boolean;
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

  /**
   * Move a document to a new parent document or collection
   */
  async moveDocument(
    documentId: string,
    collectionId: string,
    parentDocumentId: string | undefined,
    index: number,
  ): Promise<void> {
    const { error } = await this.client.POST('/documents.move', {
      body: { id: documentId, parentDocumentId, collectionId, index },
    });
    if (error) {
      throw new Error(`Failed to move document: ${error.error}`);
    }
  }

  /**
   * Upload an attachment to a document
   *
   * @param params - The parameters for the attachment
   * @param params.documentId - The ID of the document to upload the attachment to
   * @param params.filePath - The path to the file to upload
   * @returns The attachment
   */
  async uploadAttachment(params: {
    documentId: string;
    filePath: string;
  }): Promise<DocumentAttachment> {
    const file = await fs.stat(params.filePath);
    const filename = path.basename(params.filePath);
    const { data, error } = await this.client.POST('/attachments.create', {
      body: {
        documentId: params.documentId,
        name: filename,
        contentType: mime.lookup(filename) || 'application/octet-stream',
        size: file.size,
      },
    });

    if (error) {
      throw new Error(`Failed to create attachment: ${error.error}`);
    }
    await uploadFile(data.data.uploadUrl, data.data.form, params.filePath);

    return data.data.attachment;
  }

  /**
   * Download an attachment to a directory
   *
   * @param attachmentId - The ID of the attachment
   * @param attachmentDirectory - The path to save the downloaded file
   */
  async downloadAttachmentToDirectory(
    attachmentId: string,
    attachmentDirectory: string,
  ): Promise<string> {
    const response = await this.client.POST('/attachments.redirect', {
      body: { id: attachmentId },
      redirect: 'manual',
    });
    const location = response.response.headers.get('Location');
    if (!location) {
      throw new Error('No location in response');
    }
    const locationUrl = new URL(location);
    const fileExtension =
      path.extname(locationUrl.pathname) ||
      extension(
        response.response.headers.get('Content-Type') ??
          'application/octet-stream',
      ) ||
      '.bin';
    const filePath = path.join(
      attachmentDirectory,
      `${attachmentId}${fileExtension}`,
    );
    await downloadFile(location, filePath);
    return filePath;
  }
}

export function getOutlineService(apiUrl: string): OutlineService {
  const apiToken = process.env.OUTLINE_API_TOKEN;
  if (!apiToken) {
    throw new Error('OUTLINE_API_TOKEN is not set');
  }
  return new OutlineService(apiToken, apiUrl);
}
