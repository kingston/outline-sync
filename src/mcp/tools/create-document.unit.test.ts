import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { createMockDocumentCollection } from '@src/tests/factories.test-helper.js';

import { mcpCreateDocument } from './create-document.js';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('mcpCreateDocument', () => {
  let mockCollections: DocumentCollectionWithConfig[];

  beforeEach(() => {
    vol.reset();
    mockCollections = [
      {
        ...createMockDocumentCollection({
          urlId: 'test-collection',
          name: 'Test Collection',
        }),
        outputDirectory: '/output/test-collection',
        mcp: { enabled: true, readOnly: false },
      },
      {
        ...createMockDocumentCollection({
          urlId: 'read-only-collection',
          name: 'Read Only Collection',
        }),
        outputDirectory: '/output/read-only-collection',
        mcp: { enabled: true, readOnly: true },
      },
    ];
  });

  afterEach(() => {
    vol.reset();
  });

  it('should create a new document', async () => {
    const result = await mcpCreateDocument(
      {
        documentUri: 'documents://test-collection/new-doc.md',
        title: 'New Document',
        description: 'A test document',
        content: '# New Document\n\nThis is a test.',
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/new-doc.md',
    });

    const createdContent = vol.toJSON()['/output/test-collection/new-doc.md'];
    expect(createdContent).toContain('title: New Document');
    expect(createdContent).toContain('description: A test document');
    expect(createdContent).toContain('# New Document');
    expect(createdContent).toContain('This is a test.');
  });

  it('should create document without description', async () => {
    const result = await mcpCreateDocument(
      {
        documentUri: 'documents://test-collection/new-doc.md',
        title: 'New Document',
        content: '# New Document\n\nThis is a test.',
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/new-doc.md',
    });

    const createdContent = vol.toJSON()['/output/test-collection/new-doc.md'];
    expect(createdContent).toContain('title: New Document');
    expect(createdContent).not.toContain('description:');
    expect(createdContent).toContain('# New Document');
  });

  it('should throw error for non-existent collection', async () => {
    await expect(
      mcpCreateDocument(
        {
          documentUri: 'documents://non-existent/new-doc.md',
          title: 'New Document',
          content: 'Test content',
        },
        mockCollections,
      ),
    ).rejects.toThrow("Collection with key 'non-existent' not found");
  });

  it('should throw error for read-only collection', async () => {
    await expect(
      mcpCreateDocument(
        {
          documentUri: 'documents://read-only-collection/new-doc.md',
          title: 'New Document',
          content: 'Test content',
        },
        mockCollections,
      ),
    ).rejects.toThrow("Collection 'Read Only Collection' is read-only");
  });

  it('should throw error if document already exists', async () => {
    vol.fromJSON({
      '/output/test-collection/existing-doc.md': `---
title: Existing Document
---

Existing content.`,
    });

    await expect(
      mcpCreateDocument(
        {
          documentUri: 'documents://test-collection/existing-doc.md',
          title: 'New Document',
          content: 'Test content',
        },
        mockCollections,
      ),
    ).rejects.toThrow("Document already exists at path 'existing-doc.md'");
  });

  it('should handle subdirectory paths', async () => {
    const result = await mcpCreateDocument(
      {
        documentUri: 'documents://test-collection/subdir/new-doc.md',
        title: 'New Document',
        content: '# New Document\n\nThis is a test.',
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/subdir/new-doc.md',
    });

    const createdContent =
      vol.toJSON()['/output/test-collection/subdir/new-doc.md'];
    expect(createdContent).toContain('title: New Document');
    expect(createdContent).toContain('# New Document');
  });
});
