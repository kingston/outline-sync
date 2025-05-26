import type { Mock } from 'vitest';

import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '@src/types/config.js';
import type { DocumentWithChildren } from '@src/types/documents.js';

import {
  parseAttachments,
  transformMarkdownImages,
} from '@src/services/attachments.js';
import { getDocumentsForCollection } from '@src/services/documents.js';
import {
  getOutlineService,
  type OutlineService,
} from '@src/services/outline.js';
import { createMockConfig } from '@src/tests/config.test-helper.js';
import {
  createMockAttachment,
  createMockDocumentCollection,
  createMockDocumentWithChildren,
} from '@src/tests/factories.test-helper.js';

import { downloadCommand } from './download.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('ora');
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text: string) => text),
  },
}));
vi.mock('@src/services/outline.js');
vi.mock('@src/services/documents.js');
vi.mock('@src/services/attachments.js');

describe('downloadCommand', () => {
  let mockOutlineService: {
    getCollections: Mock;
    downloadAttachmentToDirectory: Mock;
  };
  let mockConfig: Config;

  beforeEach(() => {
    vol.reset();
    vi.clearAllMocks();

    // Setup mock outline service
    mockOutlineService = {
      getCollections: vi.fn(),
      downloadAttachmentToDirectory: vi.fn(),
    };
    vi.mocked(getOutlineService).mockReturnValue(
      mockOutlineService as unknown as OutlineService,
    );

    // Setup base config
    mockConfig = createMockConfig({
      outputDir: '/output',
    });

    // Setup default mocks for utilities
    vi.mocked(parseAttachments).mockReturnValue([]);
    vi.mocked(transformMarkdownImages).mockImplementation((content) => content);
  });

  afterEach(() => {
    vol.reset();
  });

  describe('successful downloads', () => {
    it('should download a single collection without children', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
        description: 'Test description',
      });

      const mockDocument = createMockDocumentWithChildren({
        id: 'doc-1',
        title: 'Test Document',
        text: '# Test Document\n\nThis is test content.',
        description: 'A test document',
        collectionId: 'col-1',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(getDocumentsForCollection).mockResolvedValue([mockDocument]);

      await downloadCommand(mockConfig, { collections: [], dir: undefined });

      // Verify the flow
      expect(getDocumentsForCollection).toHaveBeenCalledWith(
        mockOutlineService,
        'col-1',
      );
      const files = vol.toJSON();
      expect(files['/output/test-collection/test-document.md']).toEqual(
        `---
title: Test Document
description: A test document
outlineId: doc-1
sidebar:
  order: 1
---
# Test Document

This is test content.
`,
      );
    });

    it('should download documents with nested children', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockDocument = createMockDocumentWithChildren({
        id: 'doc-1',
        title: 'Parent Document',
        text: '# Parent Content',
        collectionId: 'col-1',
        children: [
          createMockDocumentWithChildren({
            id: 'doc-2',
            title: 'Child Document',
            text: '# Child Content',
            collectionId: 'col-1',
          }),
        ],
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(getDocumentsForCollection).mockResolvedValue([mockDocument]);

      await downloadCommand(mockConfig, { collections: [], dir: undefined });

      // Verify parent document was written to index.md
      const files = vol.toJSON();
      expect(files['/output/test-collection/parent-document/index.md']).toEqual(
        `---
title: Parent Document
outlineId: doc-1
sidebar:
  order: 1
---
# Parent Content
`,
      );

      // Verify child document was written
      expect(
        files['/output/test-collection/parent-document/child-document.md'],
      ).toEqual(
        `---
title: Child Document
outlineId: doc-2
sidebar:
  order: 2
---
# Child Content
`,
      );
    });

    it('should handle documents with images when includeImages is true', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockDocument = createMockDocumentWithChildren({
        id: 'doc-1',
        title: 'Document with Image',
        text: '# Document\n\n![Image](/api/attachments.redirect?id=att-123)',
        collectionId: 'col-1',
      });

      const mockAttachment = createMockAttachment({
        id: 'att-123',
        originalUrl: '/api/attachments.redirect?id=att-123',
        localPath: '/output/test-collection/images/att-123.png',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(getDocumentsForCollection).mockResolvedValue([mockDocument]);
      vi.mocked(parseAttachments).mockReturnValue([mockAttachment]);
      mockOutlineService.downloadAttachmentToDirectory.mockResolvedValue(
        '/output/test-collection/images/att-123.png',
      );
      vi.mocked(transformMarkdownImages).mockReturnValue(
        '# Document\n\n![Image](images/att-123.png)',
      );

      // Set up empty images directory
      vol.fromJSON({
        '/output/test-collection/images/.gitkeep': '',
      });

      await downloadCommand(mockConfig, { collections: [], dir: undefined });

      expect(parseAttachments).toHaveBeenCalledWith(
        '# Document\n\n![Image](/api/attachments.redirect?id=att-123)',
      );
      expect(
        mockOutlineService.downloadAttachmentToDirectory,
      ).toHaveBeenCalledWith('att-123', '/output/test-collection/images');
      expect(transformMarkdownImages).toHaveBeenCalledWith(
        '# Document\n\n![Image](/api/attachments.redirect?id=att-123)',
        [
          {
            ...mockAttachment,
            localPath: '/output/test-collection/images/att-123.png',
          },
        ],
        '/output/test-collection',
      );
      const files = vol.toJSON();
      expect(files['/output/test-collection/document-with-image.md']).toEqual(
        `---
title: Document with Image
outlineId: doc-1
sidebar:
  order: 1
---
# Document

![Image](images/att-123.png)
`,
      );
    });

    it('should skip existing images', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockDocument = createMockDocumentWithChildren({
        id: 'doc-1',
        title: 'Document with Image',
        text: '# Document\n\n![Image](/api/attachments.redirect?id=att-123)',
        collectionId: 'col-1',
      });

      const mockAttachment = createMockAttachment({
        id: 'att-123',
        originalUrl: '/api/attachments.redirect?id=att-123',
        localPath: '/output/test-collection/images/att-123.png',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(getDocumentsForCollection).mockResolvedValue([mockDocument]);
      vi.mocked(parseAttachments).mockReturnValue([mockAttachment]);

      // Set up existing image file
      vol.fromJSON({
        '/output/test-collection/images/att-123.png': 'fake image data',
      });

      await downloadCommand(mockConfig, { collections: [], dir: undefined });

      // Should NOT download the attachment since it already exists
      expect(
        mockOutlineService.downloadAttachmentToDirectory,
      ).not.toHaveBeenCalled();
    });

    it('should preserve descriptions from existing files', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockDocument = createMockDocumentWithChildren({
        id: 'doc-1',
        title: 'Test Document',
        text: '# Test Document',
        description: 'A test document',
        collectionId: 'col-1',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(getDocumentsForCollection).mockResolvedValue([mockDocument]);

      await downloadCommand(mockConfig, { collections: [], dir: undefined });

      const files = vol.toJSON();
      expect(files['/output/test-collection/test-document.md']).toEqual(
        `---
title: Test Document
description: A test document
outlineId: doc-1
sidebar:
  order: 1
---
# Test Document
`,
      );
    });

    it('should clean up unwritten files when enabled', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockDocument = createMockDocumentWithChildren({
        id: 'doc-1',
        title: 'Test Document',
        text: '# Test Document',
        collectionId: 'col-1',
      });

      vol.fromJSON({
        '/output/test-collection/test-document.md': '# Test Document',
        '/output/test-collection/test-document-2.md': '# Test Document 2',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(getDocumentsForCollection).mockResolvedValue([mockDocument]);

      await downloadCommand(mockConfig, {});

      const files = vol.toJSON();
      expect(files['/output/test-collection/test-document.md']).toContain(
        'Test Document',
      );
      expect(
        files['/output/test-collection/test-document-2.md'],
      ).toBeUndefined();
    });

    it('should skip metadata when skipMetadata is true', async () => {
      mockConfig.behavior.skipMetadata = true;

      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockDocument = createMockDocumentWithChildren({
        id: 'doc-1',
        title: 'Test Document',
        text: '# Test Document',
        description: 'A test document',
        collectionId: 'col-1',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(getDocumentsForCollection).mockResolvedValue([mockDocument]);

      await downloadCommand(mockConfig, { collections: [], dir: undefined });

      const files = vol.toJSON();
      expect(files['/output/test-collection/test-document.md']).toEqual(
        '# Test Document',
      );
    });

    it('should handle multiple collections', async () => {
      const mockCollections = [
        createMockDocumentCollection({
          id: 'col-1',
          name: 'Collection 1',
        }),
        createMockDocumentCollection({
          id: 'col-2',
          name: 'Collection 2',
        }),
      ];

      const mockDocuments: Record<string, DocumentWithChildren[]> = {
        'col-1': [
          createMockDocumentWithChildren({
            id: 'doc-1',
            title: 'Doc 1',
            text: '# Doc 1',
            collectionId: 'col-1',
          }),
        ],
        'col-2': [
          createMockDocumentWithChildren({
            id: 'doc-2',
            title: 'Doc 2',
            text: '# Doc 2',
            collectionId: 'col-2',
          }),
        ],
      };

      mockOutlineService.getCollections.mockResolvedValue(mockCollections);
      vi.mocked(getDocumentsForCollection).mockImplementation(
        (_service, collectionId) =>
          Promise.resolve(mockDocuments[collectionId] ?? []),
      );

      await downloadCommand(mockConfig, { collections: [], dir: undefined });

      expect(getDocumentsForCollection).toHaveBeenCalledTimes(2);
      const files = vol.toJSON();
      expect(files['/output/collection-1/doc-1.md']).toEqual(
        `---
title: Doc 1
outlineId: doc-1
sidebar:
  order: 1
---
# Doc 1
`,
      );
      expect(files['/output/collection-2/doc-2.md']).toEqual(
        `---
title: Doc 2
outlineId: doc-2
sidebar:
  order: 1
---
# Doc 2
`,
      );
    });
  });

  describe('error handling', () => {
    it('should handle no collections found', async () => {
      mockOutlineService.getCollections.mockResolvedValue([]);

      await downloadCommand(mockConfig, { collections: [], dir: undefined });

      expect(getDocumentsForCollection).not.toHaveBeenCalled();
      const files = vol.toJSON();
      expect(files).toEqual({});
    });

    it('should throw error when collection fetch fails', async () => {
      const error = new Error('API Error');
      mockOutlineService.getCollections.mockRejectedValue(error);

      await expect(
        downloadCommand(mockConfig, { collections: [], dir: undefined }),
      ).rejects.toThrow('API Error');
    });

    it('should throw error when document fetch fails', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(getDocumentsForCollection).mockRejectedValue(
        new Error('Document fetch error'),
      );

      await expect(
        downloadCommand(mockConfig, { collections: [], dir: undefined }),
      ).rejects.toThrow('Document fetch error');
    });
  });

  describe('collection filtering', () => {
    it('should filter collections based on command options', async () => {
      const mockCollections = [
        createMockDocumentCollection({
          id: 'col-1',
          urlId: 'col-1-url-id',
          name: 'Collection 1',
        }),
        createMockDocumentCollection({
          id: 'col-2',
          urlId: 'col-2-url-id',
          name: 'Collection 2',
        }),
      ];

      mockOutlineService.getCollections.mockResolvedValue(mockCollections);
      vi.mocked(getDocumentsForCollection).mockResolvedValue([]);

      await downloadCommand(mockConfig, {
        collections: ['col-1-url-id'],
        dir: '/custom/output',
      });

      expect(getDocumentsForCollection).toHaveBeenCalledOnce();
      expect(vi.mocked(getDocumentsForCollection).mock.calls[0][1]).toEqual(
        'col-1',
      );
    });
  });
});
