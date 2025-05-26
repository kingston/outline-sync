import type { Mocked } from 'vitest';

import { faker } from '@faker-js/faker';
import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '@src/types/config.js';
import type { ParsedDocument } from '@src/types/documents.js';

import {
  parseRelativeImages,
  transformMarkdownToAttachments,
} from '@src/services/attachments.js';
import {
  getOutlineService,
  type OutlineService,
} from '@src/services/outline.js';
import { readCollectionFiles } from '@src/services/output-files.js';
import { createMockConfig } from '@src/tests/config.test-helper.js';
import {
  createMockDocument,
  createMockDocumentCollection,
  createMockParsedDocument,
} from '@src/tests/factories.test-helper.js';

import { uploadCommand } from './upload.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('ora');
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
  },
}));
vi.mock('@src/services/outline.js');
vi.mock('@src/services/output-files.js');
vi.mock('@src/services/attachments.js');
vi.mock('@src/utils/file-manager.js');

describe('uploadCommand', () => {
  let mockOutlineService: Mocked<{
    getCollections: typeof OutlineService.prototype.getCollections;
    getDocument: typeof OutlineService.prototype.getDocument;
    createDocument: typeof OutlineService.prototype.createDocument;
    updateDocument: typeof OutlineService.prototype.updateDocument;
    moveDocument: typeof OutlineService.prototype.moveDocument;
    uploadAttachment: typeof OutlineService.prototype.uploadAttachment;
  }>;
  let mockConfig: Config;

  beforeEach(() => {
    vol.reset();
    vi.clearAllMocks();

    // Setup mock outline service
    mockOutlineService = {
      getCollections: vi.fn(),
      getDocument: vi.fn(),
      createDocument: vi.fn(),
      updateDocument: vi.fn(),
      moveDocument: vi.fn(),
      uploadAttachment: vi.fn(),
    };
    vi.mocked(getOutlineService).mockReturnValue(
      mockOutlineService as unknown as OutlineService,
    );

    // Setup base config
    mockConfig = createMockConfig({
      outputDir: '/output',
    });

    // Setup default mocks for utilities
    vi.mocked(parseRelativeImages).mockReturnValue([]);
    vi.mocked(transformMarkdownToAttachments).mockImplementation(
      (content) => content,
    );
  });

  afterEach(() => {
    vol.reset();
  });

  describe('successful uploads', () => {
    it('should create a new document when no outlineId exists', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockParsedDoc = createMockParsedDocument({
        filePath: '/output/test-collection/test-document.md',
        content: '# Test Document\n\nThis is test content.',
        metadata: {
          title: 'Test Document',
          description: 'A test document',
        },
        collectionId: 'col-1',
      });

      const mockCreatedDoc = createMockDocument({
        id: 'doc-1',
        title: 'Test Document',
        text: '# Test Document\n\nThis is test content.',
        collectionId: 'col-1',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(readCollectionFiles).mockResolvedValue([mockParsedDoc]);
      mockOutlineService.createDocument.mockResolvedValue(mockCreatedDoc);

      await uploadCommand(mockConfig, { collections: [] });

      expect(mockOutlineService.createDocument).toHaveBeenCalledWith({
        title: 'Test Document',
        text: '# Test Document\n\nThis is test content.',
        collectionId: 'col-1',
        parentDocumentId: undefined,
        publish: true,
      });
    });

    it('should update an existing document when outlineId exists', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockParsedDoc = createMockParsedDocument({
        filePath: '/output/test-collection/test-document.md',
        content: '# Updated Document\n\nThis is updated content.',
        metadata: {
          title: 'Test Document',
          outlineId: 'doc-1',
        },
        collectionId: 'col-1',
      });

      const mockExistingDoc = createMockDocument({
        id: 'doc-1',
        title: 'Test Document',
        text: '# Test Document\n\nThis is old content.',
        collectionId: 'col-1',
      });

      const mockUpdatedDoc = createMockDocument({
        id: 'doc-1',
        title: 'Test Document',
        text: '# Updated Document\n\nThis is updated content.',
        collectionId: 'col-1',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(readCollectionFiles).mockResolvedValue([mockParsedDoc]);
      mockOutlineService.getDocument.mockResolvedValue(mockExistingDoc);
      mockOutlineService.updateDocument.mockResolvedValue(mockUpdatedDoc);

      await uploadCommand(mockConfig, { collections: [] });

      expect(mockOutlineService.getDocument).toHaveBeenCalledWith('doc-1');
      expect(mockOutlineService.updateDocument).toHaveBeenCalledWith('doc-1', {
        title: 'Test Document',
        text: '# Updated Document\n\nThis is updated content.',
      });
    });

    it('should skip documents with no changes', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockParsedDoc = createMockParsedDocument({
        filePath: '/output/test-collection/test-document.md',
        content: '# Test Document\n\nThis is test content.',
        metadata: {
          title: 'Test Document',
          outlineId: 'doc-1',
        },
        collectionId: 'col-1',
      });

      const mockExistingDoc = createMockDocument({
        id: 'doc-1',
        title: 'Test Document',
        text: '# Test Document\n\nThis is test content.',
        collectionId: 'col-1',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(readCollectionFiles).mockResolvedValue([mockParsedDoc]);
      mockOutlineService.getDocument.mockResolvedValue(mockExistingDoc);

      await uploadCommand(mockConfig, { collections: [] });

      expect(mockOutlineService.updateDocument).not.toHaveBeenCalled();
    });

    it('should handle documents with parent relationships', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockParentDoc = createMockParsedDocument({
        filePath: '/output/test-collection/parent-document/index.md',
        content: '# Parent Document',
        metadata: {
          title: 'Parent Document',
        },
        collectionId: 'col-1',
      });

      const mockChildDoc = createMockParsedDocument({
        filePath: '/output/test-collection/parent-document/child-document.md',
        content: '# Child Document',
        metadata: {
          title: 'Child Document',
        },
        collectionId: 'col-1',
        parentDocumentId: '/output/test-collection/parent-document/index.md',
      });

      const mockCreatedParent = createMockDocument({
        id: 'parent-1',
        title: 'Parent Document',
        text: '# Parent Document',
        collectionId: 'col-1',
      });

      const mockCreatedChild = createMockDocument({
        id: 'child-1',
        title: 'Child Document',
        text: '# Child Document',
        collectionId: 'col-1',
        parentDocumentId: 'parent-1',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(readCollectionFiles).mockResolvedValue([
        mockParentDoc,
        mockChildDoc,
      ]);
      mockOutlineService.createDocument
        .mockResolvedValueOnce(mockCreatedParent)
        .mockResolvedValueOnce(mockCreatedChild);

      await uploadCommand(mockConfig, { collections: [] });

      expect(mockOutlineService.createDocument).toHaveBeenCalledWith({
        title: 'Parent Document',
        text: '# Parent Document',
        collectionId: 'col-1',
        parentDocumentId: undefined,
        publish: true,
      });

      expect(mockOutlineService.createDocument).toHaveBeenCalledWith({
        title: 'Child Document',
        text: '# Child Document',
        collectionId: 'col-1',
        parentDocumentId: 'parent-1',
        publish: true,
      });
    });

    it('should handle images when includeImages is true', async () => {
      mockConfig.behavior.includeImages = true;

      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockParsedDoc = createMockParsedDocument({
        filePath: '/output/test-collection/test-document.md',
        content: '# Document\n\n![Image](./images/test.png)',
        metadata: {
          title: 'Document with Image',
        },
        collectionId: 'col-1',
      });

      const mockCreatedDoc = createMockDocument({
        id: 'doc-1',
        title: 'Document with Image',
        text: '# Document\n\n![Image](./images/test.png)',
        collectionId: 'col-1',
      });

      const mockUploadedAttachment = {
        url: 'https://outline.com/api/attachments/att-123',
        name: 'test.png',
        contentType: 'image/png',
        size: 100,
      };

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(readCollectionFiles).mockResolvedValue([mockParsedDoc]);
      vi.mocked(parseRelativeImages).mockReturnValue([
        {
          caption: 'Image',
          relativePath: 'images/test.png',
          isExistingAttachment: false,
        },
      ]);
      mockOutlineService.createDocument.mockResolvedValue(mockCreatedDoc);
      mockOutlineService.uploadAttachment.mockResolvedValue(
        mockUploadedAttachment,
      );
      mockOutlineService.updateDocument.mockResolvedValue({
        ...mockCreatedDoc,
        text: '# Document\n\n![Image](https://outline.com/api/attachments/att-123)',
      });

      // Mock file existence
      vol.fromJSON({
        '/output/test-collection/images/test.png': 'fake image data',
      });

      await uploadCommand(mockConfig, { collections: [] });

      expect(mockOutlineService.uploadAttachment).toHaveBeenCalledWith({
        documentId: 'doc-1',
        filePath: '/output/test-collection/images/test.png',
      });
    });

    it('should move documents when parent or collection changes', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const parentDocumentId = faker.string.uuid();

      const mockParsedDoc = createMockParsedDocument({
        filePath: '/output/test-collection/test-document.md',
        content: '# Test Document',
        metadata: {
          title: 'Test Document',
          outlineId: 'doc-1',
        },
        collectionId: 'col-1',
        parentDocumentId,
      });

      const mockExistingDoc = createMockDocument({
        id: 'doc-1',
        title: 'Test Document',
        text: '# Test Document',
        collectionId: 'col-1',
        parentDocumentId: undefined, // Different parent
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(readCollectionFiles).mockResolvedValue([mockParsedDoc]);
      mockOutlineService.getDocument.mockResolvedValue(mockExistingDoc);

      await uploadCommand(mockConfig, { collections: [] });

      expect(mockOutlineService.moveDocument).toHaveBeenCalledWith(
        'doc-1',
        'col-1',
        parentDocumentId,
        expect.any(Number) as number,
      );
    });

    it('should skip new documents when updateOnly is true', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockParsedDoc = createMockParsedDocument({
        filePath: '/output/test-collection/test-document.md',
        content: '# Test Document',
        metadata: {
          title: 'Test Document',
        },
        collectionId: 'col-1',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(readCollectionFiles).mockResolvedValue([mockParsedDoc]);

      await uploadCommand(mockConfig, { collections: [], updateOnly: true });

      expect(mockOutlineService.createDocument).not.toHaveBeenCalled();
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

      const mockDocs: Record<string, ParsedDocument[]> = {
        'col-1': [
          createMockParsedDocument({
            filePath: '/output/collection-1/doc-1.md',
            content: '# Doc 1',
            metadata: { title: 'Doc 1' },
            collectionId: 'col-1',
          }),
        ],
        'col-2': [
          createMockParsedDocument({
            filePath: '/output/collection-2/doc-2.md',
            content: '# Doc 2',
            metadata: { title: 'Doc 2' },
            collectionId: 'col-2',
          }),
        ],
      };

      mockOutlineService.getCollections.mockResolvedValue(mockCollections);
      vi.mocked(readCollectionFiles).mockImplementation((collection) =>
        Promise.resolve(mockDocs[collection.id] ?? []),
      );
      mockOutlineService.createDocument.mockImplementation((params) =>
        Promise.resolve(
          createMockDocument({
            id: `doc-${params.collectionId}`,
            title: params.title,
            text: params.text,
            collectionId: params.collectionId,
          }),
        ),
      );

      await uploadCommand(mockConfig, { collections: [] });

      expect(readCollectionFiles).toHaveBeenCalledTimes(2);
      expect(mockOutlineService.createDocument).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle no collections found', async () => {
      mockOutlineService.getCollections.mockResolvedValue([]);

      await uploadCommand(mockConfig, { collections: [] });

      expect(readCollectionFiles).not.toHaveBeenCalled();
    });

    it('should throw error when collection fetch fails', async () => {
      const error = new Error('API Error');
      mockOutlineService.getCollections.mockRejectedValue(error);

      await expect(
        uploadCommand(mockConfig, { collections: [] }),
      ).rejects.toThrow('API Error');
    });

    it('should handle parent document resolution errors', async () => {
      const mockCollection = createMockDocumentCollection({
        id: 'col-1',
        name: 'Test Collection',
      });

      const mockChildDoc = createMockParsedDocument({
        filePath: '/output/test-collection/child-document.md',
        content: '# Child Document',
        metadata: {
          title: 'Child Document',
        },
        collectionId: 'col-1',
        parentDocumentId: '/output/test-collection/non-existent-parent.md',
      });

      mockOutlineService.getCollections.mockResolvedValue([mockCollection]);
      vi.mocked(readCollectionFiles).mockResolvedValue([mockChildDoc]);

      // Should throw an error
      await expect(
        uploadCommand(mockConfig, { collections: [] }),
      ).rejects.toThrow('Parent document not found');
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
      vi.mocked(readCollectionFiles).mockResolvedValue([]);

      await uploadCommand(mockConfig, {
        collections: ['col-1-url-id'],
        dir: '/custom/output',
      });

      expect(readCollectionFiles).toHaveBeenCalledOnce();
      expect(vi.mocked(readCollectionFiles).mock.calls[0][0]).toMatchObject({
        id: 'col-1',
      });
    });
  });
});
