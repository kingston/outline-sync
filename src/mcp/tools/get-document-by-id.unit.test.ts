import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { createMockDocumentCollection } from '@src/tests/factories.test-helper.js';

import { mcpGetDocumentById } from './get-document-by-id.js';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('mcpGetDocumentById', () => {
  let mockCollections: DocumentCollectionWithConfig[];

  beforeEach(() => {
    vol.reset();
    mockCollections = [
      {
        ...createMockDocumentCollection({
          name: 'Test Collection',
        }),
        outputDirectory: '/output/test-collection',
        mcp: { enabled: true, readOnly: false },
      },
    ];
  });

  afterEach(() => {
    vol.reset();
  });

  it('should get document by ID', async () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174000';
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
description: Test description
outlineId: ${documentId}
---
# Test Content

This is the content.`,
    });

    const result = await mcpGetDocumentById(
      {
        documentId,
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/test-doc.md',
      title: 'Test Document',
      description: 'Test description',
      content: '# Test Content\n\nThis is the content.',
    });
  });

  it('should get document without description', async () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174000';
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
outlineId: ${documentId}
---
# Test Content

This is the content.`,
    });

    const result = await mcpGetDocumentById(
      {
        documentId,
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/test-doc.md',
      title: 'Test Document',
      content: '# Test Content\n\nThis is the content.',
    });
    expect(result.description).toBeUndefined();
  });

  it('should throw error for non-existent document', async () => {
    await expect(
      mcpGetDocumentById(
        {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
        },
        mockCollections,
      ),
    ).rejects.toThrow(
      "Document with ID '123e4567-e89b-12d3-a456-426614174000' not found",
    );
  });

  it('should handle subdirectory paths', async () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174000';
    vol.fromJSON({
      '/output/test-collection/subdir/index.md': `---
title: Test Document
outlineId: ${documentId}
---
Content in subdirectory.`,
    });

    const result = await mcpGetDocumentById(
      {
        documentId,
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/subdir/index.md',
      title: 'Test Document',
      content: 'Content in subdirectory.',
    });
  });
});
