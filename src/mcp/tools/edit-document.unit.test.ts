import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { createMockDocumentCollection } from '@src/tests/factories.test-helper.js';

import { mcpEditDocument } from './edit-document.js';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('mcpEditDocument', () => {
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
      {
        ...createMockDocumentCollection({
          name: 'Read Only Collection',
        }),
        outputDirectory: '/output/readonly-collection',
        mcp: { enabled: true, readOnly: true },
      },
    ];
  });

  afterEach(() => {
    vol.reset();
  });

  it('should edit document title', async () => {
    // Set up test file
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Original Title
description: Original description
outlineId: doc-123
---

# Original Title

This is the original content.`,
    });

    const result = await mcpEditDocument(
      {
        documentUri: 'documents://test-collection/test-doc.md',
        title: 'New Title',
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/test-doc.md',
    });

    const updatedContent = vol.toJSON()['/output/test-collection/test-doc.md'];
    expect(updatedContent).toContain('title: New Title');
    expect(updatedContent).toContain('description: Original description');
    expect(updatedContent).toContain('This is the original content.');
  });

  it('should edit document description', async () => {
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
outlineId: doc-123
---

Content here.`,
    });

    const result = await mcpEditDocument(
      {
        documentUri: 'documents://test-collection/test-doc.md',
        description: 'New description',
      },
      mockCollections,
    );

    expect(result.documentUri).toEqual(
      'documents://test-collection/test-doc.md',
    );

    const updatedContent = vol.toJSON()['/output/test-collection/test-doc.md'];
    expect(updatedContent).toContain('description: New description');
  });

  it('should edit document content', async () => {
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
---

Old content.`,
    });

    const result = await mcpEditDocument(
      {
        documentUri: 'documents://test-collection/test-doc.md',
        content: '# New Heading\n\nNew content here.',
      },
      mockCollections,
    );

    expect(result.documentUri).toEqual(
      'documents://test-collection/test-doc.md',
    );

    const updatedContent = vol.toJSON()['/output/test-collection/test-doc.md'];
    expect(updatedContent).toContain('# New Heading');
    expect(updatedContent).toContain('New content here.');
    expect(updatedContent).not.toContain('Old content.');
  });

  it('should edit multiple fields at once', async () => {
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Old Title
description: Old description
---

Old content.`,
    });

    const result = await mcpEditDocument(
      {
        documentUri: 'documents://test-collection/test-doc.md',
        title: 'New Title',
        description: 'New description',
        content: 'New content.',
      },
      mockCollections,
    );

    expect(result.documentUri).toEqual(
      'documents://test-collection/test-doc.md',
    );

    const updatedContent = vol.toJSON()['/output/test-collection/test-doc.md'];
    expect(updatedContent).toContain('title: New Title');
    expect(updatedContent).toContain('description: New description');
    expect(updatedContent).toContain('New content.');
  });

  it('should clear description when empty string provided', async () => {
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
description: Will be removed
---

Content.`,
    });

    await mcpEditDocument(
      {
        documentUri: 'documents://test-collection/test-doc.md',
        description: '',
      },
      mockCollections,
    );

    const updatedContent = vol.toJSON()['/output/test-collection/test-doc.md'];
    expect(updatedContent).not.toContain('description:');
  });

  it('should throw error for non-existent collection', async () => {
    await expect(
      mcpEditDocument(
        {
          documentUri: 'documents://non-existent/test-doc.md',
          title: 'New Title',
        },
        mockCollections,
      ),
    ).rejects.toThrow("Collection with key 'non-existent' not found");
  });

  it('should throw error for read-only collection', async () => {
    vol.fromJSON({
      '/output/read-only-collection/test-doc.md': `---
title: Test Document
---

Content.`,
    });

    await expect(
      mcpEditDocument(
        {
          documentUri: 'documents://read-only-collection/test-doc.md',
          title: 'New Title',
        },
        mockCollections,
      ),
    ).rejects.toThrow("Collection 'Read Only Collection' is read-only");
  });

  it('should throw error for non-existent document', async () => {
    await expect(
      mcpEditDocument(
        {
          documentUri: 'documents://test-collection/non-existent.md',
          title: 'New Title',
        },
        mockCollections,
      ),
    ).rejects.toThrow("Document not found at path 'non-existent.md'");
  });
});
