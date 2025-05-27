import type { FaissStore } from '@langchain/community/vectorstores/faiss';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import type { Config } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import {
  createIndexedRagStoreFromCollections,
  searchRagStores,
} from '@src/services/rag-store.js';

export function setupSearchRagDocumentsTool(
  server: McpServer,
  config: Config,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool(
    'search-rag-documents',
    'Search across document chunks using RAG (Retrieval-Augmented Generation) for finding specific passages',
    {
      query: z
        .string()
        .describe('The search query to find similar document chunks'),
      limit: z
        .number()
        .describe('Maximum number of chunks to return (default: 10)')
        .default(10),
    },
    async (args) => {
      const { query, limit = 10 } = args;

      if (!config.languageModel) {
        throw new Error(
          'Language model configuration is required for RAG search',
        );
      }

      if (!query || query.trim().length === 0) {
        throw new Error('Search query is required');
      }

      let ragStores: FaissStore[];
      try {
        ragStores = await createIndexedRagStoreFromCollections(
          config.languageModel,
          collections,
        );
      } catch (error) {
        throw new Error(
          `Failed to create RAG search index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      const results = await searchRagStores(ragStores, query, {
        limit,
      });

      const searchResults = results.results.map((result) => ({
        documentUri: result.documentUri,
        content: result.content,
        score: Number.parseFloat(result.score.toFixed(3)),
        ...(result.loc ? { location: result.loc } : {}),
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
