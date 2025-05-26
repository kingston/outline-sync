import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { createSafeFilename } from '@src/utils/file-names.js';

export interface McpCollectionInfo {
  name: string;
  key: string;
  description: string | null;
  readOnly: boolean;
}

export function setupListCollectionsTool(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool(
    'list-collections',
    'List all available Outline collections configured for sync',
    {},
    async () => {
      const collectionInfos: McpCollectionInfo[] = await Promise.all(
        collections.map((collection) => {
          const info: McpCollectionInfo = {
            name: collection.name,
            key: createSafeFilename(collection.name),
            description: collection.description,
            readOnly: collection.mcp.readOnly,
          };

          return info;
        }),
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                collections: collectionInfos,
                total: collectionInfos.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
