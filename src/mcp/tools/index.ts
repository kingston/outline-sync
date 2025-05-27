import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Config } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { setupCreateDocumentTool } from './create-document.js';
import { setupEditDocumentTool } from './edit-document.js';
import { setupGetDocumentByIdTool } from './get-document-by-id.js';
import { setupGetDocumentTool } from './get-document.js';
import { setupInlineEditTool } from './inline-edit.js';
import { setupListCollectionsTool } from './list-collections.js';
import { setupListDocumentsTool } from './list-documents.js';
import { setupSearchDocumentsTool } from './search-documents.js';

export function setupMcpTools(
  server: McpServer,
  config: Config,
  collections: DocumentCollectionWithConfig[],
): void {
  setupGetDocumentTool(server, collections);
  setupGetDocumentByIdTool(server, collections);
  setupListCollectionsTool(server, collections);
  setupListDocumentsTool(server, collections);
  setupEditDocumentTool(server, collections);
  setupInlineEditTool(server, collections);
  setupCreateDocumentTool(server, collections);
  setupSearchDocumentsTool(server, config, collections);
}
