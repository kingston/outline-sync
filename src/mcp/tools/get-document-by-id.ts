import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { readCollectionFiles } from '@src/services/output-files.js';
import { createSafeFilename } from '@src/utils/file-names.js';

export interface GetDocumentByIdParams {
  documentId: string;
}

export interface GetDocumentByIdResult {
  documentUri: string;
  title: string;
  description?: string;
  content: string;
}

/**
 * Get details of a local document file by its UUID
 * @throws Error if document not found
 */
export async function mcpGetDocumentById(
  params: GetDocumentByIdParams,
  collections: DocumentCollectionWithConfig[],
): Promise<GetDocumentByIdResult> {
  // Search through all collections for the document
  for (const collection of collections) {
    const documents = await readCollectionFiles(collection);
    const document = documents.find(
      (doc) => doc.metadata.outlineId === params.documentId,
    );

    if (document) {
      return {
        documentUri: `documents://${createSafeFilename(collection.name)}/${document.relativePath}`,
        title: document.metadata.title,
        description: document.metadata.description,
        content: document.content,
      };
    }
  }

  throw new Error(`Document with ID '${params.documentId}' not found`);
}

export function setupGetDocumentByIdTool(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool(
    'get-document-by-id',
    'Get details of a local document file by its UUID',
    {
      documentId: z
        .string()
        .describe('The UUID of the document to get')
        .uuid('Invalid document UUID'),
    },
    async (getParams) => {
      const result = await mcpGetDocumentById(getParams, collections);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
