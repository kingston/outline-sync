import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';

import type { Config } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { MCPServer } from '../server.js';

export interface McpTestSetup {
  config: Config;
  collections: DocumentCollectionWithConfig[];
  version?: string;
}

export interface McpToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpTestContext {
  server: MCPServer;
  client: Client;
  callMcpTool: <T = unknown>(toolCall: McpToolCall) => Promise<T>;
  cleanup: () => Promise<void>;
}

export async function setupMcpTest({
  config,
  collections,
  version = '1.0.0',
}: McpTestSetup): Promise<McpTestContext> {
  const server = new MCPServer(config, collections, version);
  const clientTransport = await server.startInMemoryTransport();

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    },
  );

  await client.connect(clientTransport);

  const callMcpTool = async <T = unknown>(
    toolCall: McpToolCall,
  ): Promise<T> => {
    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: toolCall.name,
          arguments: toolCall.arguments ?? {},
        },
      },
      CallToolResultSchema,
    );

    const typedResult = result as CallToolResult;
    if (typedResult.content.length === 0) {
      throw new Error('No content returned from tool call');
    }

    const firstContent = typedResult.content[0];
    if (firstContent.type !== 'text' || typeof firstContent.text !== 'string') {
      throw new Error('Expected text content from tool call');
    }

    return JSON.parse(firstContent.text) as T;
  };

  const cleanup = async (): Promise<void> => {
    await client.close();
    await server.close();
  };

  return {
    server,
    client,
    callMcpTool,
    cleanup,
  };
}

// Common mock data for tests
export function createMockCollections(): DocumentCollectionWithConfig[] {
  return [
    {
      id: 'col1',
      urlId: 'engineering',
      name: 'Engineering Docs',
      description: 'Engineering documentation',
      outputDirectory: '/tmp/engineering',
      mcp: {
        enabled: true,
        readOnly: false,
      },
    },
    {
      id: 'col2',
      urlId: 'product',
      name: 'Product Docs',
      description: 'Product documentation',
      outputDirectory: '/tmp/product',
      mcp: {
        enabled: true,
        readOnly: true,
      },
    },
  ];
}
