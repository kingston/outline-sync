import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import matter from 'gray-matter';
import { vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutlineService } from '@src/services/outline.js';
import type { Config, LanguageModelConfig } from '@src/types/config.js';
import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { getLanguageChatModel } from '@src/services/langchain.js';
import { getOutlineService } from '@src/services/outline.js';
import { createMockConfig } from '@src/tests/config.test-helper.js';
import { getCollectionConfigs } from '@src/utils/collection-filter.js';

import {
  annotateCommand,
  annotateFile,
  getTitleDescription,
} from './annotate.js';

vi.mock('@src/services/langchain.js');
vi.mock('@src/services/outline.js');
vi.mock('@src/utils/collection-filter.js');
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('ora');

describe('annotate', () => {
  const mockLanguageModel = {
    provider: 'openai',
    searchIndexDirectory: '/test/search-index',
  } as LanguageModelConfig;
  const mockConfig: Config = createMockConfig({
    languageModel: mockLanguageModel,
  });

  const mockCollection: DocumentCollectionWithConfig = {
    name: 'test-collection',
    outputDirectory: '/test/output/test-collection',
    mcp: { enabled: true, readOnly: false },
    id: 'test-id',
    urlId: 'test-url',
    description: 'Test collection',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();

    const mockModel = {
      withStructuredOutput: vi.fn().mockReturnValue({
        invoke: vi.fn().mockResolvedValue({
          title: 'Test Title',
          description: 'Test Description',
        }),
      }),
    } as unknown as BaseChatModel;

    vi.mocked(getLanguageChatModel).mockResolvedValue(mockModel);
  });

  describe('getTitleDescription', () => {
    it('should generate title and description for a file', async () => {
      const filePath = 'test.md';
      const frontmatter = matter('---\n---\nTest content');

      const result = await getTitleDescription(
        filePath,
        frontmatter,
        mockLanguageModel,
      );

      expect(result).toEqual({
        title: 'Test Title',
        description: 'Test Description',
      });
    });
  });

  describe('annotateFile', () => {
    it('should skip file if title and description exist', async () => {
      const filePath = 'test.md';
      const frontmatter = matter(
        '---\ntitle: Existing Title\ndescription: Existing Description\n---\nContent',
      );

      const result = await annotateFile(
        filePath,
        frontmatter,
        mockLanguageModel,
      );

      expect(result).toEqual({ result: 'skipped' });
    });

    it('should update file if metadata is missing', async () => {
      const filePath = '/output/test.md';
      const content = '---\n---\nContent';
      const frontmatter = matter(content);

      vol.fromJSON({
        [filePath]: content,
      });

      const result = await annotateFile(
        filePath,
        frontmatter,
        mockLanguageModel,
      );

      expect(result).toEqual({ result: 'updated' });
      const files = vol.toJSON();
      expect(files[filePath]).toContain('title: Test Title');
      expect(files[filePath]).toContain('description: Test Description');
    });

    it('should keep title if it exists but add description', async () => {
      const filePath = '/output/test.md';
      const content = '---\ntitle: Existing Title\n---\nContent';
      const frontmatter = matter(content);

      vol.fromJSON({
        [filePath]: content,
      });

      const result = await annotateFile(
        filePath,
        frontmatter,
        mockLanguageModel,
      );

      expect(result).toEqual({ result: 'updated' });
      const files = vol.toJSON();
      expect(files[filePath]).toContain('title: Existing Title');
      expect(files[filePath]).toContain('description: Test Description');
      expect(files[filePath]).not.toContain('title: Test Title');
    });
  });

  describe('annotateCommand', () => {
    it('should process all collections', async () => {
      const mockCollections = [mockCollection];
      const mockOutlineService = {
        getCollections: vi.fn().mockResolvedValue([]),
      } as unknown as OutlineService;

      const testFilePath = '/test/output/test-collection/test.md';
      vol.fromJSON({
        [testFilePath]: '---\n---\nContent',
      });

      vi.mocked(getOutlineService).mockReturnValue(mockOutlineService);
      vi.mocked(getCollectionConfigs).mockReturnValue(mockCollections);

      await annotateCommand(mockConfig, {});

      expect(getOutlineService).toHaveBeenCalledWith(mockConfig.outline.apiUrl);
      expect(getCollectionConfigs).toHaveBeenCalled();
      const files = vol.toJSON();
      expect(files[testFilePath]).toContain('title: Test Title');
      expect(files[testFilePath]).toContain('description: Test Description');
    });

    it('should throw error if language model config is missing', async () => {
      const configWithoutModel = { ...mockConfig, languageModel: undefined };

      await expect(annotateCommand(configWithoutModel, {})).rejects.toThrow(
        'Language model configuration is required',
      );
    });
  });
});
