import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

export interface McpCollectionInfo {
  name: string;
  key: string;
  outputDirectory: string;
  readOnly: boolean;
}

export function setupListCollectionsTool(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool('list-collections', {}, async () => {
    const collectionInfos: McpCollectionInfo[] = await Promise.all(
      collections.map((collection) => {
        const info: McpCollectionInfo = {
          name: collection.name,
          key: collection.urlId,
          outputDirectory: collection.outputDirectory,
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
  });
}
