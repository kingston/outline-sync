import type { Request, Response } from 'express';

import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

import type { Config, McpOptions } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { setupMcpDocumentResource } from './resources/documents.js';
import { setupMcpTools } from './tools/index.js';

const sendMethodNotAllowed = (req: Request, res: Response): void => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32_000,
        message: 'Method not allowed.',
      },
      id: null,
    }),
  );
};

export class MCPServer {
  private server: McpServer;
  private collections: DocumentCollectionWithConfig[];

  constructor(
    private config: Config,
    collections: DocumentCollectionWithConfig[],
    version: string,
    private options: McpOptions = {},
  ) {
    this.server = new McpServer({
      name: 'outline-sync',
      version,
    });
    this.collections = collections.filter((c) => c.mcp.enabled);

    // Register handlers
    this.registerHandlers();
  }

  async start(): Promise<void> {
    if (this.collections.length === 0) {
      throw new Error('No collections configured for MCP');
    }

    const transport =
      this.options.transport ?? (this.config.mcp.transport as string);

    if (transport === 'stdio') {
      await this.startStdioTransport();
    } else if (transport === 'streamable-http') {
      await this.startSseTransport();
    } else {
      throw new Error(`Unknown transport type: ${transport}`);
    }
  }

  private async startStdioTransport(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  public async startInMemoryTransport(): Promise<InMemoryTransport> {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await this.server.connect(serverTransport);
    return clientTransport;
  }

  private async startSseTransport(): Promise<void> {
    const app = express();
    app.use(express.json());

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await this.server.connect(transport);

    app.get('/mcp', sendMethodNotAllowed);
    app.delete('/mcp', sendMethodNotAllowed);

    app.post('/mcp', async (req: Request, res: Response) => {
      try {
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32_603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    app.on('close', () => {
      transport.close().catch(console.error);
      this.server.close().catch(console.error);
    });

    const port = this.options.port ?? this.config.mcp.port;
    app.listen(port, () => {
      console.info(
        `MCP server started for outline-sync (SSE transport on "http://localhost:${port.toString()}/mcp")...`,
      );
      this.logExposedCollections();
    });
  }

  private logExposedCollections(): void {
    console.info(`Exposing:`);
    for (const collection of this.collections) {
      console.info(
        `  * ${collection.name} (${collection.mcp.readOnly ? 'read-only' : 'read-write'}): ${collection.outputDirectory}`,
      );
    }
  }

  private registerHandlers(): void {
    setupMcpDocumentResource(this.server, this.collections);
    setupMcpTools(this.server, this.config, this.collections);
  }

  public close(): Promise<void> {
    return this.server.close();
  }
}
