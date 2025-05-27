import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import path from 'node:path';
import { z } from 'zod';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { readDocumentFile } from '@src/services/output-files.js';
import { fileExists } from '@src/utils/file-manager.js';
import { createSafeFilename } from '@src/utils/file-names.js';

import { DOCUMENT_URI_REGEX, parseDocumentUri } from '../utils/document-uri.js';

export interface GetDocumentParams {
  documentUri: string;
}

export interface GetDocumentResult {
  documentUri: string;
  title: string;
  description?: string;
  content: string;
}

/**
 * Get details of a local document file
 * @throws Error if collection not found or document not found
 */
export async function mcpGetDocument(
  params: GetDocumentParams,
  collections: DocumentCollectionWithConfig[],
): Promise<GetDocumentResult> {
  const { collectionKey, documentPath } = parseDocumentUri(params.documentUri);

  // Find the collection
  const collection = collections.find(
    (c) => createSafeFilename(c.name) === collectionKey,
  );
  if (!collection) {
    throw new Error(`Collection with key '${collectionKey}' not found`);
  }

  // Construct the full file path
  const fullPath = path.join(collection.outputDirectory, documentPath);

  // Check if file exists
  if (!(await fileExists(fullPath))) {
    throw new Error(`Document not found at path '${documentPath}'`);
  }

  // Read the document
  const document = await readDocumentFile(fullPath, collection);

  return {
    documentUri: params.documentUri,
    title: document.metadata.title,
    description: document.metadata.description,
    content: document.content,
  };
}

export function setupGetDocumentTool(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool(
    'get-document',
    'Get details of a local document file',
    {
      documentUri: z
        .string()
        .describe('The URI of the document to get')
        .regex(
          DOCUMENT_URI_REGEX,
          'Invalid document URI. Should be in the format documents://{collectionKey}/{documentPath}',
        ),
    },
    async (getParams) => {
      const result = await mcpGetDocument(getParams, collections);

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
