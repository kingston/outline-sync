import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { Config } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { setupMcpDocumentResource } from './resources/documents.js';

export class MCPServer {
  private server: McpServer;
  private collections: DocumentCollectionWithConfig[];

  constructor(
    private config: Config,
    collections: DocumentCollectionWithConfig[],
    version: string,
  ) {
    this.server = new McpServer({
      name: 'outline-sync',
      version,
    });
    this.collections = collections.filter((c) => c.mcp.enabled);
  }

  async start(): Promise<void> {
    // Register handlers
    this.registerHandlers();

    if (this.collections.length === 0) {
      throw new Error('No collections configured for MCP');
    }

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.info('MCP server started for outline-sync...');
    console.info(`Exposing:`);
    for (const collection of this.collections) {
      console.info(
        `  * ${collection.name} (${collection.mcp.readOnly ? 'read-only' : 'read-write'})`,
      );
    }
  }

  private registerHandlers(): void {
    setupMcpDocumentResource(this.server, this.collections);
  }
}
