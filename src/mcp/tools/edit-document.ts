import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import path from 'node:path';
import { z } from 'zod';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { readDocumentFile } from '@src/services/output-files.js';
import { fileExists, writeDocumentFile } from '@src/utils/file-manager.js';
import { createSafeFilename } from '@src/utils/file-names.js';

import { DOCUMENT_URI_REGEX, parseDocumentUri } from '../utils/document-uri.js';

export interface EditDocumentParams {
  documentUri: string;
  title?: string;
  description?: string;
  content?: string;
}

export interface EditDocumentResult {
  documentUri: string;
}

/**
 * Edit a local document file by updating its title, description, and/or content
 * @throws Error if collection not found, read-only, or document not found
 */
export async function mcpEditDocument(
  params: EditDocumentParams,
  collections: DocumentCollectionWithConfig[],
): Promise<EditDocumentResult> {
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

  // Check if file exists
  if (!(await fileExists(fullPath))) {
    throw new Error(`Document not found at path '${documentPath}'`);
  }

  // Read the current document
  const document = await readDocumentFile(fullPath, collection);

  // Update metadata if provided
  const updatedMetadata = { ...document.metadata };
  if (params.title !== undefined) {
    updatedMetadata.title = params.title;
  }
  if (params.description !== undefined) {
    updatedMetadata.description = params.description || undefined;
  }

  // Use provided content or existing content
  const updatedContent = params.content ?? document.content;

  // Write the updated document
  await writeDocumentFile(fullPath, updatedContent, updatedMetadata);

  return {
    documentUri: params.documentUri,
  };
}

export function setupEditDocumentTool(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool(
    'edit-document',
    'Edit a local document file by updating its title, description, and/or content',
    {
      documentUri: z
        .string()
        .describe('The URI of the document to edit')
        .regex(
          DOCUMENT_URI_REGEX,
          'Invalid document URI. Should be in the format documents://{collectionKey}/{documentPath}',
        ),
      title: z
        .string()
        .optional()
        .describe(
          'The new title of the document (if undefined, the title will not be changed)',
        ),
      description: z
        .string()
        .optional()
        .describe(
          'The new description of the document (if undefined, the description will not be changed)',
        ),
      content: z
        .string()
        .optional()
        .describe(
          'The new content of the document (if undefined, the content will not be changed)',
        ),
    },
    async (editParams) => {
      const result = await mcpEditDocument(editParams, collections);

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
