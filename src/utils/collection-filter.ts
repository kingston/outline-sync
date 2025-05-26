import path from 'node:path';

import type { DocumentCollection } from '@src/types/collections.js';
import type { CollectionMcpConfig, Config } from '@src/types/config.js';

import { createSafeFilename } from './file-manager.js';

export interface DocumentCollectionWithConfig extends DocumentCollection {
  outputDirectory: string;
  mcp: CollectionMcpConfig;
}

/**
 * Filter collections based on provided collection names, config, or all collections
 */
export function getCollectionConfigs(
  allCollections: DocumentCollection[],
  config: Config,
  overrides: {
    /**
     * Filter collections by URL IDs
     */
    collectionUrlIdsFilter?: string[];
    /**
     * Override the output directory for the collections
     */
    outputDir?: string;
  } = {},
): DocumentCollectionWithConfig[] {
  const { collectionUrlIdsFilter = [], outputDir = config.outputDir } =
    overrides;
  // check if all config collections are present in the allCollections array
  const missingConfigCollections = config.collections.filter(
    (c) => !allCollections.some((ac) => ac.urlId === c.urlId),
  );
  if (missingConfigCollections.length > 0) {
    throw new Error(
      `Collection not found in Outline: ${missingConfigCollections.map((c) => c.urlId).join(', ')}`,
    );
  }

  return allCollections
    .filter(
      (collection) =>
        config.collections.length === 0 ||
        config.collections.some((c) => c.urlId === collection.urlId),
    )
    .filter(
      (collection) =>
        collectionUrlIdsFilter.length === 0 ||
        collectionUrlIdsFilter.includes(collection.urlId),
    )
    .map((collection) => {
      const collectionConfig = config.collections.find(
        (c) => c.urlId === collection.urlId,
      );
      const defaultName = createSafeFilename(collection.name);
      return {
        ...collection,
        outputDirectory: path.join(
          path.resolve(outputDir),
          collectionConfig?.directory ?? defaultName,
        ),
        mcp: collectionConfig?.mcp ?? { enabled: false, readOnly: false },
      };
    });
}
