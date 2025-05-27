import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { createMockDocumentCollection } from '@src/tests/factories.test-helper.js';

import { mcpGetDocument } from './get-document.js';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('mcpGetDocument', () => {
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

  it('should get document details', async () => {
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
description: Test description
---
# Test Content

This is the content.`,
    });

    const result = await mcpGetDocument(
      {
        documentUri: 'documents://test-collection/test-doc.md',
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
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
---q
# Test Content

This is the content.`,
    });

    const result = await mcpGetDocument(
      {
        documentUri: 'documents://test-collection/test-doc.md',
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

  it('should throw error for non-existent collection', async () => {
    await expect(
      mcpGetDocument(
        {
          documentUri: 'documents://non-existent/test-doc.md',
        },
        mockCollections,
      ),
    ).rejects.toThrow("Collection with key 'non-existent' not found");
  });

  it('should throw error for non-existent document', async () => {
    await expect(
      mcpGetDocument(
        {
          documentUri: 'documents://test-collection/non-existent.md',
        },
        mockCollections,
      ),
    ).rejects.toThrow("Document not found at path 'non-existent.md'");
  });

  it('should handle subdirectory paths', async () => {
    vol.fromJSON({
      '/output/test-collection/subdir/test-doc.md': `---
title: Test Document
---
Content in subdirectory.`,
    });

    const result = await mcpGetDocument(
      {
        documentUri: 'documents://test-collection/subdir/test-doc.md',
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/subdir/test-doc.md',
      title: 'Test Document',
      content: 'Content in subdirectory.',
    });
  });
});
