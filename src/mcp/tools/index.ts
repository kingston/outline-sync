import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Config } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { setupListCollectionsTool } from './list-collections.js';

export function setupMcpTools(
  server: McpServer,
  config: Config,
  collections: DocumentCollectionWithConfig[],
): void {
  setupListCollectionsTool(server, collections);
}
