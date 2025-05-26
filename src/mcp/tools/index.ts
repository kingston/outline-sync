import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Config } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { setupCreateDocumentTool } from './create-document.js';
import { setupEditDocumentTool } from './edit-document.js';
import { setupInlineEditTool } from './inline-edit.js';
import { setupListCollectionsTool } from './list-collections.js';

export function setupMcpTools(
  server: McpServer,
  _config: Config,
  collections: DocumentCollectionWithConfig[],
): void {
  setupListCollectionsTool(server, collections);
  setupEditDocumentTool(server, collections);
  setupInlineEditTool(server, collections);
  setupCreateDocumentTool(server, collections);
}
