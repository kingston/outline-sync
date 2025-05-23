import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { readCollectionFiles } from '@src/services/output-files.js';

export function setupMcpDocumentResource(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.resource(
    'document',
    new ResourceTemplate('documents://{collectionId}/{documentPath*}', {
      list: async () => {
        const documentArrays = await Promise.all(
          collections.map(async (collection) => {
            const documents = await readCollectionFiles(collection);
            return documents.map((document) => ({
              uri: `documents://${document.filePath}`,
              name: document.metadata.title,
              description: document.metadata.description,
              mimeType: 'text/markdown',
            }));
          }),
        );
        return {
          resources: documentArrays.flat(),
        };
      },
    }),
    async (uri, { collectionId, documentPath }) => {
      if (typeof documentPath !== 'string') {
        throw new TypeError(`Document path must be a string`);
      }
      if (typeof collectionId !== 'string') {
        throw new TypeError(`Collection ID must be a string`);
      }
      const collection = collections.find(
        (collection) => collection.id === collectionId,
      );
      if (!collection) {
        throw new Error(`Collection not found: ${collectionId}`);
      }
      const documents = await readCollectionFiles(collection);
      const document = documents.find(
        (document) => document.relativePath === documentPath,
      );
      if (!document) {
        throw new Error(`Document not found: ${documentPath}`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            text: document.content,
            mimeType: 'text/markdown',
          },
        ],
      };
    },
  );
}
