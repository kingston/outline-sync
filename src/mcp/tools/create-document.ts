import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import path from 'node:path';
import { z } from 'zod';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { fileExists, writeDocumentFile } from '@src/utils/file-manager.js';
import { createSafeFilename } from '@src/utils/file-names.js';

import { DOCUMENT_URI_REGEX, parseDocumentUri } from '../utils/document-uri.js';

export interface CreateDocumentParams {
  documentUri: string;
  title: string;
  description?: string;
  content: string;
}

export interface CreateDocumentResult {
  documentUri: string;
}

/**
 * Create a new local document file
 * @throws Error if collection not found, read-only, or document already exists
 */
export async function mcpCreateDocument(
  params: CreateDocumentParams,
  collections: DocumentCollectionWithConfig[],
): Promise<CreateDocumentResult> {
  const { collectionKey, documentPath } = parseDocumentUri(params.documentUri);

  // Find the collection
  const collection = collections.find(
    (c) => createSafeFilename(c.name) === collectionKey,
  );
  if (!collection) {
    throw new Error(`Collection with key '${collectionKey}' not found`);
  }

  // Check if collection is read-only
  if (collection.mcp.readOnly) {
    throw new Error(`Collection '${collection.name}' is read-only`);
  }

  // Construct the full file path
  const fullPath = path.join(collection.outputDirectory, documentPath);

  // Check if file already exists
  if (await fileExists(fullPath)) {
    throw new Error(`Document already exists at path '${documentPath}'`);
  }

  // Create the document
  await writeDocumentFile(fullPath, params.content, {
    title: params.title,
    description: params.description,
  });

  return {
    documentUri: params.documentUri,
  };
}

export function setupCreateDocumentTool(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool(
    'create-document',
    'Create a new local document file',
    {
      documentUri: z
        .string()
        .describe('The URI of the document to create')
        .regex(
          DOCUMENT_URI_REGEX,
          'Invalid document URI. Should be in the format documents://{collectionKey}/{documentPath}',
        ),
      title: z.string().describe('The title of the document'),
      description: z
        .string()
        .optional()
        .describe('Optional description of the document'),
      content: z.string().describe('The content of the document'),
    },
    async (createParams) => {
      const result = await mcpCreateDocument(createParams, collections);

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
