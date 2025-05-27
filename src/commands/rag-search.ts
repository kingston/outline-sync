import type { FaissStore } from '@langchain/community/vectorstores/faiss';

import ora from 'ora';

import type { Config, SearchOptions } from '@src/types/config.js';

import { getOutlineService } from '@src/services/outline.js';
import {
  createIndexedRagStoreFromCollections,
  searchRagStores,
} from '@src/services/rag-store.js';
import { getCollectionConfigs } from '@src/utils/collection-filter.js';

export async function ragSearchCommand(
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
    text: 'Creating RAG search index...',
  }).start();
  let ragStores: FaissStore[];
  try {
    ragStores = await createIndexedRagStoreFromCollections(
      config.languageModel,
      collections,
    );
    spinner.succeed('RAG search index created!');
  } catch (error) {
    spinner.fail();
    throw error;
  }

  const results = await searchRagStores(ragStores, options.query, {
    limit: options.limit ? Number.parseInt(options.limit, 10) : undefined,
  });

  // Print results
  console.info(
    `\nFound ${results.results.length.toString()} relevant passages:\n`,
  );

  for (const [index, result] of results.results.entries()) {
    console.info(`${(index + 1).toString()}. Document: ${result.documentUri}`);
    console.info(`   Score: ${result.score.toFixed(3)}`);
    if (result.loc) {
      console.info(
        `   Location: line ${String(result.loc.lines?.from)} - ${String(result.loc.lines?.to)}`,
      );
    }
    console.info(`\n   Content:`);
    console.info(`   ${result.content.trim()}`);
    console.info('   ---\n');
  }
}
