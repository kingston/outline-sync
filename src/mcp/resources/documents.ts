import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { readCollectionFiles } from '@src/services/output-files.js';
import { createSafeFilename } from '@src/utils/file-names.js';

export function setupMcpDocumentResource(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.resource(
    'document',
    new ResourceTemplate('documents://{collectionKey}/{documentPath}', {
      list: async () => {
        const documentArrays = await Promise.all(
          collections.map(async (collection) => {
            const documents = await readCollectionFiles(collection);
            const collectionKey = createSafeFilename(collection.name);
            return documents.map((document) => ({
              uri: `documents://${collectionKey}/${createSafeFilename(document.relativePath)}`,
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
    async (uri, { collectionKey, documentPath }) => {
      if (typeof documentPath !== 'string') {
        throw new TypeError(`Document path must be a string`);
      }
      if (typeof collectionKey !== 'string') {
        throw new TypeError(`Collection key must be a string`);
      }

      const collection = collections.find(
        (collection) => createSafeFilename(collection.name) === collectionKey,
      );
      if (!collection) {
        throw new Error(`Collection not found: ${collectionKey}`);
      }

      const documents = await readCollectionFiles(collection);

      const document = documents.find(
        (document) =>
          createSafeFilename(document.relativePath) === documentPath,
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
