import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { createMockDocumentCollection } from '@src/tests/factories.test-helper.js';

import { mcpInlineEdit } from './inline-edit.js';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('mcpInlineEdit', () => {
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
          urlId: 'readonly-collection',
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

  it('should perform single replacement', async () => {
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
---

Hello world!`,
    });

    const result = await mcpInlineEdit(
      {
        documentUri: 'documents://test-collection/test-doc.md',
        commands: [
          {
            oldText: 'world',
            newText: 'there',
          },
        ],
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/test-doc.md',
      counts: [1],
    });

    const updatedContent = vol.toJSON()['/output/test-collection/test-doc.md'];
    expect(updatedContent).toContain('Hello there!');
  });

  it('should perform multiple replacements', async () => {
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
---

Hello world! Hello world!`,
    });

    const result = await mcpInlineEdit(
      {
        documentUri: 'documents://test-collection/test-doc.md',
        commands: [
          {
            oldText: 'world',
            newText: 'there',
            numReplacements: 2,
          },
        ],
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/test-doc.md',
      counts: [2],
    });

    const updatedContent = vol.toJSON()['/output/test-collection/test-doc.md'];
    expect(updatedContent).toContain('Hello there! Hello there!');
  });

  it('should apply multiple commands in sequence', async () => {
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
---

Hello world! This is a test.`,
    });

    const result = await mcpInlineEdit(
      {
        documentUri: 'documents://test-collection/test-doc.md',
        commands: [
          {
            oldText: 'world',
            newText: 'there',
          },
          {
            oldText: 'test',
            newText: 'example',
          },
        ],
      },
      mockCollections,
    );

    expect(result).toEqual({
      documentUri: 'documents://test-collection/test-doc.md',
      counts: [1, 1],
    });

    const updatedContent = vol.toJSON()['/output/test-collection/test-doc.md'];
    expect(updatedContent).toContain('Hello there! This is a example.');
  });

  it('should throw error for wrong number of replacements', async () => {
    vol.fromJSON({
      '/output/test-collection/test-doc.md': `---
title: Test Document
---

Hello world!`,
    });

    await expect(
      mcpInlineEdit(
        {
          documentUri: 'documents://test-collection/test-doc.md',
          commands: [
            {
              oldText: 'world',
              newText: 'there',
              numReplacements: 2,
            },
          ],
        },
        mockCollections,
      ),
    ).rejects.toThrow("Expected 2 replacements for 'world', but found 1");
  });

  it('should throw error for non-existent collection', async () => {
    await expect(
      mcpInlineEdit(
        {
          documentUri: 'documents://non-existent/test-doc.md',
          commands: [
            {
              oldText: 'world',
              newText: 'there',
            },
          ],
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

Hello world!`,
    });

    await expect(
      mcpInlineEdit(
        {
          documentUri: 'documents://read-only-collection/test-doc.md',
          commands: [
            {
              oldText: 'world',
              newText: 'there',
            },
          ],
        },
        mockCollections,
      ),
    ).rejects.toThrow("Collection 'Read Only Collection' is read-only");
  });

  it('should throw error for non-existent document', async () => {
    await expect(
      mcpInlineEdit(
        {
          documentUri: 'documents://test-collection/non-existent.md',
          commands: [
            {
              oldText: 'world',
              newText: 'there',
            },
          ],
        },
        mockCollections,
      ),
    ).rejects.toThrow("Document not found at path 'non-existent.md'");
  });
});
