import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { readCollectionFiles } from '@src/services/output-files.js';
import { createSafeFilename } from '@src/utils/file-names.js';

export interface ListDocumentsParams {
  collectionKey?: string;
  prefix?: string;
  keywords?: string;
}

export interface ListDocumentsResult {
  documents: {
    documentUri: string;
    title: string;
    description?: string;
  }[];
}

/**
 * List documents with optional filtering
 */
export async function mcpListDocuments(
  params: ListDocumentsParams,
  collections: DocumentCollectionWithConfig[],
): Promise<ListDocumentsResult> {
  // Filter collections if collectionKey is provided
  let filteredCollections = collections;
  if (params.collectionKey) {
    filteredCollections = collections.filter(
      (c) => createSafeFilename(c.name) === params.collectionKey,
    );
    if (filteredCollections.length === 0) {
      throw new Error(
        `Collection with key '${params.collectionKey}' not found`,
      );
    }
  }

  // Read documents from all matching collections
  const documentArrays = await Promise.all(
    filteredCollections.map(async (collection) => {
      const documents = await readCollectionFiles(collection);
      const collectionKey = createSafeFilename(collection.name);

      return documents
        .filter((document) => {
          // Apply prefix filter if provided
          if (
            params.prefix &&
            !document.relativePath.startsWith(params.prefix)
          ) {
            return false;
          }

          // Apply keywords filter if provided
          if (params.keywords) {
            const searchTerms = params.keywords
              .toLowerCase()
              .split(/\s+/)
              .filter((term) => term.length > 0);

            // Create searchable text from title, description, and content
            const searchableText = [
              document.metadata.title,
              document.metadata.description ?? '',
              document.content,
            ]
              .join(' ')
              .toLowerCase();

            // Check if all search terms exist in the searchable text
            const allTermsFound = searchTerms.every((term) =>
              searchableText.includes(term),
            );

            if (!allTermsFound) {
              return false;
            }
          }

          return true;
        })
        .map((document) => ({
          documentUri: `documents://${collectionKey}/${document.relativePath}`,
          title: document.metadata.title,
          description: document.metadata.description,
        }));
    }),
  );

  return {
    documents: documentArrays.flat(),
  };
}

export function setupListDocumentsTool(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool(
    'list-documents',
    'List available documents with optional filtering by collection, prefix path, or keywords',
    {
      collectionKey: z
        .string()
        .optional()
        .describe('Optional collection key to filter documents'),
      prefix: z
        .string()
        .optional()
        .describe('Optional prefix path to filter documents by subdirectory'),
      keywords: z
        .string()
        .optional()
        .describe(
          'Optional space-separated keywords to search in document title, description, or content. All keywords must be present.',
        ),
    },
    async (listParams) => {
      const result = await mcpListDocuments(listParams, collections);

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
