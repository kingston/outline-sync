import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { type Config, configSchema } from '@src/types/config.js';

import type { McpTestContext } from '../utils/mcp-runner.test-helper.js';
import type { McpCollectionInfo } from './list-collections.js';

import {
  createMockCollections,
  setupMcpTest,
} from '../utils/mcp-runner.test-helper.js';

vi.mock('node:fs/promises');

describe('list-collections tool', () => {
  let mockConfig: Config;
  let mockCollections: DocumentCollectionWithConfig[];
  let mcpContext: McpTestContext | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = configSchema.parse({});
    mockCollections = createMockCollections();
  });

  afterEach(async () => {
    await mcpContext?.cleanup();
  });

  it('should list collections without stats', async () => {
    mcpContext = await setupMcpTest({
      config: mockConfig,
      collections: mockCollections,
    });

    const result = await mcpContext.callMcpTool<{
      collections: McpCollectionInfo[];
      total: number;
    }>({
      name: 'list-collections',
      arguments: {},
    });

    expect(result).toEqual({
      collections: [
        {
          name: 'Engineering Docs',
          key: 'engineering-docs',
          description: 'Engineering documentation',
          readOnly: false,
        },
        {
          name: 'Product Docs',
          key: 'product-docs',
          description: 'Product documentation',
          readOnly: true,
        },
      ],
      total: 2,
    });
  });

  it('should only list MCP-enabled collections', async () => {
    const collectionsWithDisabled: DocumentCollectionWithConfig[] = [
      ...mockCollections,
      {
        id: 'col3',
        urlId: 'disabled',
        name: 'Disabled Collection',
        description: 'This should not appear',
        outputDirectory: '/tmp/disabled',
        mcp: {
          enabled: false,
          readOnly: false,
        },
      },
    ];

    mcpContext = await setupMcpTest({
      config: mockConfig,
      collections: collectionsWithDisabled,
    });

    const result = await mcpContext.callMcpTool<{
      collections: McpCollectionInfo[];
      total: number;
    }>({
      name: 'list-collections',
      arguments: {},
    });

    expect(result.total).toBe(2);
    expect(result.collections).not.toContainEqual(
      expect.objectContaining({
        name: 'Disabled Collection',
      }),
    );
  });
});
