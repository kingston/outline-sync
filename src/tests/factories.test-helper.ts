import { faker } from '@faker-js/faker';

import type { AttachmentInfo } from '@src/services/attachments.js';
import type { DocumentCollection } from '@src/types/collections.js';
import type {
  Document,
  DocumentFrontmatter,
  DocumentWithChildren,
  ParsedDocument,
} from '@src/types/documents.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

export function createMockDocument(
  overrides: Partial<Document> = {},
): Document {
  return {
    id: faker.string.uuid(),
    urlId: faker.string.alphanumeric(8),
    title: faker.lorem.sentence(),
    collectionId: faker.string.uuid(),
    text: faker.lorem.paragraphs(),
    ...overrides,
  };
}

export function createMockDocumentWithChildren(
  overrides: Partial<DocumentWithChildren> = {},
): DocumentWithChildren {
  return {
    children: [],
    ...createMockDocument(overrides),
  };
}

export function createMockDocumentCollection(
  overrides: Partial<DocumentCollection> = {},
): DocumentCollection {
  return {
    id: faker.string.uuid(),
    urlId: faker.string.alphanumeric(8),
    name: faker.lorem.sentence(),
    description: faker.lorem.sentence(),
    ...overrides,
  };
}

export function createMockDocumentCollectionWithConfig(
  overrides: Partial<DocumentCollectionWithConfig> = {},
): DocumentCollectionWithConfig {
  return {
    ...createMockDocumentCollection(overrides),
    outputDirectory: faker.system.directoryPath(),
    mcp: {
      enabled: true,
      readOnly: false,
    },
  };
}

export function createMockAttachment(
  overrides: Partial<AttachmentInfo> = {},
): AttachmentInfo {
  return {
    id: faker.string.uuid(),
    caption: faker.lorem.sentence(),
    originalUrl: faker.internet.url(),
    localPath: faker.system.filePath(),
    ...overrides,
  };
}

export function createMockParsedDocument(
  overrides: Partial<
    Omit<ParsedDocument, 'metadata'> & {
      metadata?: Partial<DocumentFrontmatter>;
    }
  > = {},
): ParsedDocument {
  return {
    content: faker.lorem.paragraphs(),
    filePath: faker.system.filePath(),
    relativePath: faker.system.filePath(),
    collectionId: faker.string.uuid(),
    relativeIndex: faker.number.int(),
    lastModifiedAt: faker.date.recent(),
    ...overrides,
    metadata: {
      title: faker.lorem.sentence(),
      description: faker.lorem.sentence(),
      outlineId: faker.string.uuid(),
      urlId: faker.string.alphanumeric(8),
      sidebar: {
        order: faker.number.int(),
      },
      ...overrides.metadata,
    },
  };
}
