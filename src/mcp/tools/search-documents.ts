import type { FaissStore } from '@langchain/community/vectorstores/faiss';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import type { Config } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import {
  createIndexedVectorStoreFromCollections,
  searchVectorStores,
} from '@src/services/vector-store.js';

export function setupSearchDocumentsTool(
  server: McpServer,
  config: Config,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool(
    'search-documents',
    'Search across Outline documents using semantic similarity',
    {
      query: z.string().describe('The search query to find similar documents'),
      limit: z
        .number()
        .describe('Maximum number of results to return (default: 5)')
        .default(5),
      includeContents: z
        .boolean()
        .describe(
          'Whether to include document contents in results (default: false)',
        )
        .default(false),
    },
    async (args) => {
      const { query, limit = 5, includeContents = false } = args;

      if (!config.languageModel) {
        throw new Error('Language model configuration is required for search');
      }

      if (!query || query.trim().length === 0) {
        throw new Error('Search query is required');
      }

      let vectorStores: FaissStore[];
      try {
        vectorStores = await createIndexedVectorStoreFromCollections(
          config.languageModel,
          collections,
          { apiUrl: config.outline.apiUrl },
        );
      } catch (error) {
        throw new Error(
          `Failed to create search index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      const results = await searchVectorStores(vectorStores, query, {
        includeDocumentContents: includeContents,
        limit,
      });

      const searchResults = results.results.map((result) => ({
        title: result.title,
        description: result.description,
        uri: result.uri,
        score: result.score.toFixed(2),
        ...(includeContents && result.content
          ? { content: result.content }
          : {}),
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query,
                results: searchResults,
                total: searchResults.length,
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
