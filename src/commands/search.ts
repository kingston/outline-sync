import type { FaissStore } from '@langchain/community/vectorstores/faiss';

import ora from 'ora';

import type { Config, SearchOptions } from '@src/types/config.js';

import { getOutlineService } from '@src/services/outline.js';
import {
  createIndexedVectorStoreFromCollections,
  searchVectorStores,
} from '@src/services/vector-store.js';
import { getCollectionConfigs } from '@src/utils/collection-filter.js';

export async function searchCommand(
  config: Config,
  options: SearchOptions,
): Promise<void> {
  if (!config.languageModel) {
    throw new Error('Language model configuration is required');
  }

  if (!options.query) {
    throw new Error('Search query is required');
  }

  const service = getOutlineService(config.outline.apiUrl);
  const outlineCollections = await service.getCollections();
  const collections = getCollectionConfigs(outlineCollections, config, {
    collectionUrlIdsFilter: options.collections,
    outputDir: options.dir,
  });

  const spinner = ora({
    hideCursor: false,
    text: 'Creating search index...',
  }).start();
  let vectorStores: FaissStore[];
  try {
    vectorStores = await createIndexedVectorStoreFromCollections(
      config.languageModel,
      collections,
      { showLogs: true },
    );
    spinner.succeed('Search index created!');
  } catch (error) {
    spinner.fail();
    throw error;
  }

  const results = await searchVectorStores(vectorStores, options.query, {
    includeDocumentContents: options.includeContents,
    limit: options.limit ? Number.parseInt(options.limit, 10) : undefined,
  });

  // Print results
  for (const result of results.results) {
    console.info(`\nTitle: ${result.title}`);
    console.info(`Description: ${result.description}`);
    console.info(`Score: ${result.score.toFixed(2)}`);
    console.info(`URI: ${result.uri}`);
    if (result.content) {
      console.info('\nContent:');
      console.info(result.content);
    }
    console.info('---');
  }
}
