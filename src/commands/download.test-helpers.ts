import type { DocumentCollection } from '@src/types/collections.js';
import type { CollectionMcpConfig } from '@src/types/config.js';
import type { DocumentWithChildren, ParsedDocument } from '@src/types/documents.js';
import type { AttachmentInfo } from '@src/services/attachments.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

export function createMockCollection(
  overrides: Partial<DocumentCollection> = {},
): DocumentCollection {
  return {
    id: 'col-1',
    urlId: 'test-collection',
    name: 'Test Collection',
    description: null,
    ...overrides,
  };
}

export function createMockDocument(
  overrides: Partial<DocumentWithChildren> = {},
): DocumentWithChildren {
  return {
    id: 'doc-1',
    title: 'Test Document',
    text: '# Test Document',
    description: undefined,
    collectionId: 'col-1',
    children: [],
    ...overrides,
  };
}

export function createMockCollectionWithConfig(
  overrides: Partial<DocumentCollectionWithConfig> = {},
): DocumentCollectionWithConfig {
  const collection = createMockCollection(overrides);
  const mcp: CollectionMcpConfig = {
    enabled: false,
    readOnly: false,
    ...overrides.mcp,
  };
  
  return {
    ...collection,
    outputDirectory: '/output/test-collection',
    mcp,
    ...overrides,
  };
}

export function createMockAttachment(
  overrides: Partial<AttachmentInfo> = {},
): AttachmentInfo {
  return {
    id: 'att-123',
    caption: 'Image',
    originalUrl: '/api/attachments.redirect?id=att-123',
    localPath: '/output/test-collection/images/att-123.png',
    ...overrides,
  };
}

export function createMockParsedDocument(
  overrides: Partial<ParsedDocument> = {},
): ParsedDocument {
  return {
    metadata: {
      title: 'Existing Document',
      description: 'Existing description',
      outlineId: 'doc-1',
      sidebar: { order: 0 },
    },
    content: '# Existing Document\n\nSome content',
    filePath: '/output/test-collection/existing-document.md',
    relativePath: 'existing-document.md',
    collectionId: 'col-1',
    relativeIndex: 0,
    ...overrides,
  };
}