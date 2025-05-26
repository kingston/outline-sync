import { MCPServer } from '@src/mcp/server.js';
import { getOutlineService } from '@src/services/outline.js';
import { getCollectionConfigs } from '@src/utils/collection-filter.js';
import { getPackageVersion } from '@src/utils/version.js';

import type { Config, McpOptions } from '../types/config.js';

/**
 * Start MCP server for AI assistant integration
 */
export async function mcpCommand(
  config: Config,
  options: McpOptions,
): Promise<void> {
  const service = getOutlineService(config.outline.apiUrl);
  const outlineCollections = await service.getCollections();
  const collections = getCollectionConfigs(outlineCollections, config, {
    collectionUrlIdsFilter: options.collections,
    outputDir: options.dir,
  });
  const version = await getPackageVersion();

  // Initialize and start MCP server
  const server = new MCPServer(config, collections, version, options);
  await server.start();

  // Keep the process running
  process.on('SIGINT', () => {
    console.error('\nShutting down MCP server...');
    process.exit(0);
  });
}
