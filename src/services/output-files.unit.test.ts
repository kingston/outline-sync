import { vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import {
  cleanupUnwrittenFiles,
  readCollectionFiles,
  readDocumentFile,
} from './output-files.js';

// The fs mocks are automatically loaded from src/__mocks__/
vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('output-files', () => {
  const mockCollection: DocumentCollectionWithConfig = {
    id: 'test-collection',
    urlId: 'test-collection',
    name: 'Test Collection',
    description: 'Test collection description',
    outputDirectory: '/test/output',
    mcp: { enabled: false, readOnly: false },
  };

  beforeEach(() => {
    vol.reset();
  });

  describe('readDocumentFile', () => {
    it('should read and parse a document file with valid frontmatter', async () => {
      const filePath = '/test/output/doc.md';
      const fileContent = `---
title: Test Document
sidebar:
  order: 1
outlineId: doc-123
---

# Test Document

This is the content.`;

      vol.fromJSON({
        [filePath]: fileContent,
      });

      const result = await readDocumentFile(filePath, mockCollection);

      expect(result).toEqual({
        metadata: {
          title: 'Test Document',
          sidebar: { order: 1 },
          outlineId: 'doc-123',
        },
        content: '\n# Test Document\n\nThis is the content.',
        filePath,
        relativePath: 'doc.md',
        collectionId: 'test-collection',
        parentDocumentId: undefined,
      });
    });

    it('should include parent document ID when provided', async () => {
      const filePath = '/test/output/subdoc.md';
      const fileContent = `---
title: Sub Document
---

Content`;

      vol.fromJSON({
        [filePath]: fileContent,
      });

      const result = await readDocumentFile(
        filePath,
        mockCollection,
        'parent-123',
      );

      expect(result.parentDocumentId).toBe('parent-123');
    });

    it('should throw an error for invalid frontmatter', async () => {
      const filePath = '/test/output/invalid.md';
      const fileContent = `---
invalidField: value
---

Content`;

      vol.fromJSON({
        [filePath]: fileContent,
      });

      await expect(readDocumentFile(filePath, mockCollection)).rejects.toThrow(
        'Failed to parse document file /test/output/invalid.md',
      );
    });

    it('should throw an error for documents without required title', async () => {
      const filePath = '/test/output/no-title.md';
      const fileContent = `---
description: No title here
---

# Just Content

No title in frontmatter.`;

      vol.fromJSON({
        [filePath]: fileContent,
      });

      await expect(readDocumentFile(filePath, mockCollection)).rejects.toThrow(
        'Failed to parse document file /test/output/no-title.md',
      );
    });
  });

  describe('readCollectionFiles', () => {
    it('should read a flat collection of markdown files', async () => {
      vol.fromJSON({
        '/test/output/doc1.md': `---
title: Document 1
sidebar:
  order: 2
---
Content 1`,
        '/test/output/doc2.md': `---
title: Document 2
sidebar:
  order: 1
---
Content 2`,
        '/test/output/readme.txt': 'Not a markdown file',
      });

      const result = await readCollectionFiles(mockCollection);

      expect(result).toHaveLength(2);
      expect(result[0].metadata.title).toBe('Document 2');
      expect(result[0].relativeIndex).toBe(0);
      expect(result[1].metadata.title).toBe('Document 1');
      expect(result[1].relativeIndex).toBe(1);
    });

    it('should handle nested directories with index.md files', async () => {
      vol.fromJSON({
        '/test/output/index.md': `---
title: Root Index
outlineId: root-123
---
Root content`,
        '/test/output/subdir/index.md': `---
title: Subdir Index
outlineId: subdir-123
---
Subdir content`,
        '/test/output/subdir/child.md': `---
title: Child Document
---
Child content`,
      });

      const result = await readCollectionFiles(mockCollection);

      expect(result).toHaveLength(3);

      const rootDoc = result.find((doc) => doc.metadata.title === 'Root Index');
      expect(rootDoc?.parentDocumentId).toBeUndefined();

      const subdirDoc = result.find(
        (doc) => doc.metadata.title === 'Subdir Index',
      );
      expect(subdirDoc?.parentDocumentId).toBeUndefined();

      const childDoc = result.find(
        (doc) => doc.metadata.title === 'Child Document',
      );
      expect(childDoc?.parentDocumentId).toBe('subdir-123');
    });

    it('should use file path as parent ID when outline ID is not set', async () => {
      vol.fromJSON({
        '/test/output/parent/index.md': `---
title: Parent Without ID
---
Content`,
        '/test/output/parent/child.md': `---
title: Child
---
Content`,
      });

      const result = await readCollectionFiles(mockCollection);

      const childDoc = result.find((doc) => doc.metadata.title === 'Child');
      expect(childDoc?.parentDocumentId).toBe('/test/output/parent/index.md');
    });

    it('should throw error if subdirectory has markdown files but no index.md', async () => {
      vol.fromJSON({
        '/test/output/subdir/doc.md': `---
title: Document
---
Content`,
      });

      await expect(readCollectionFiles(mockCollection)).rejects.toThrow(
        'Index file /test/output/subdir/index.md not found. All subdirectories with md files must have an index.md file.',
      );
    });

    it('should skip directories without markdown files', async () => {
      vol.fromJSON({
        '/test/output/index.md': `---
title: Root
---
Content`,
        '/test/output/images/image.png': 'binary data',
        '/test/output/data/config.json': '{}',
      });

      const result = await readCollectionFiles(mockCollection);

      expect(result).toHaveLength(1);
      expect(result[0].metadata.title).toBe('Root');
    });

    it('should handle empty collection directory', async () => {
      vol.fromJSON({
        '/test/output': null,
      });

      const result = await readCollectionFiles(mockCollection);

      expect(result).toEqual([]);
    });

    it('should correctly sort documents by sidebar order', async () => {
      vol.fromJSON({
        '/test/output/doc1.md': `---
title: Doc 1
sidebar:
  order: 3
---`,
        '/test/output/doc2.md': `---
title: Doc 2
sidebar:
  order: 1
---`,
        '/test/output/doc3.md': `---
title: Doc 3
---`,
        '/test/output/doc4.md': `---
title: Doc 4
sidebar:
  order: 2
---`,
      });

      const result = await readCollectionFiles(mockCollection);

      expect(result.map((doc) => doc.metadata.title)).toEqual([
        'Doc 3',
        'Doc 2',
        'Doc 4',
        'Doc 1',
      ]);
    });
  });

  describe('cleanupUnwrittenFiles', () => {
    it('should delete files not in the written paths set', async () => {
      vol.fromJSON({
        '/test/output/keep1.md': 'content',
        '/test/output/keep2.md': 'content',
        '/test/output/delete1.md': 'content',
        '/test/output/delete2.md': 'content',
      });

      const writtenPaths = new Set([
        '/test/output',
        '/test/output/keep1.md',
        '/test/output/keep2.md',
      ]);

      const deletedCount = await cleanupUnwrittenFiles(
        '/test/output',
        writtenPaths,
      );

      expect(deletedCount).toBe(2);
      expect(await vol.promises.readdir('/test/output')).toEqual([
        'keep1.md',
        'keep2.md',
      ]);
    });

    it('should delete empty directories not in written paths', async () => {
      vol.fromJSON({
        '/test/output/keep/file.md': 'content',
        '/test/output/delete': null,
        '/test/output/nested/empty': null,
      });

      const writtenPaths = new Set([
        '/test/output',
        '/test/output/keep',
        '/test/output/keep/file.md',
      ]);

      const deletedCount = await cleanupUnwrittenFiles(
        '/test/output',
        writtenPaths,
      );

      expect(deletedCount).toBe(3); // nested, nested/empty, delete
      expect(await vol.promises.readdir('/test/output')).toEqual(['keep']);
    });

    it('should not delete non-empty directories', async () => {
      vol.fromJSON({
        '/test/output/dir/file.md': 'content',
      });

      const writtenPaths = new Set(['/test/output']);

      const deletedCount = await cleanupUnwrittenFiles(
        '/test/output',
        writtenPaths,
      );

      expect(deletedCount).toBe(2); // file.md and the dir (which becomes empty after file deletion)
      // Directory should have been deleted because it became empty
      const contents = await vol.promises
        .readdir('/test/output')
        .catch(() => []);
      expect(contents).toEqual([]);
    });

    it('should handle nested structures correctly', async () => {
      vol.fromJSON({
        '/test/output/a/b/c/file.md': 'content',
        '/test/output/a/b/delete.md': 'content',
      });

      const writtenPaths = new Set([
        '/test/output',
        '/test/output/a',
        '/test/output/a/b',
        '/test/output/a/b/c',
        '/test/output/a/b/c/file.md',
      ]);

      const deletedCount = await cleanupUnwrittenFiles(
        '/test/output',
        writtenPaths,
      );

      expect(deletedCount).toBe(1);
      expect(await vol.promises.readdir('/test/output/a/b')).toEqual(['c']);
    });

    it('should handle non-existent output directory gracefully', async () => {
      const writtenPaths = new Set<string>();

      const deletedCount = await cleanupUnwrittenFiles(
        '/non/existent',
        writtenPaths,
      );

      expect(deletedCount).toBe(0);
    });

    it('should handle concurrent deletions gracefully', async () => {
      vol.fromJSON({
        '/test/output/file1.md': 'content',
        '/test/output/file2.md': 'content',
      });

      const writtenPaths = new Set(['/test/output']);

      const deletedCount = await cleanupUnwrittenFiles(
        '/test/output',
        writtenPaths,
      );

      expect(deletedCount).toBe(2);
    });
  });
});
