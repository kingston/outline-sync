import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { createMockDocumentCollection } from '@src/tests/factories.test-helper.js';

import { mcpListDocuments } from './list-documents.js';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('mcpListDocuments', () => {
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
          name: 'Another Collection',
        }),
        outputDirectory: '/output/another-collection',
        mcp: { enabled: true, readOnly: false },
      },
    ];
  });

  afterEach(() => {
    vol.reset();
  });

  it('should list all documents from all collections', async () => {
    vol.fromJSON({
      '/output/test-collection/doc1.md': `---
title: Document 1
description: First document
---
# Content 1`,
      '/output/test-collection/doc2.md': `---
title: Document 2
---
# Content 2`,
      '/output/another-collection/doc3.md': `---
title: Document 3
description: Third document
---
# Content 3`,
    });

    const result = await mcpListDocuments({}, mockCollections);

    expect(result.documents).toHaveLength(3);
    expect(result.documents).toContainEqual({
      documentUri: 'documents://test-collection/doc1.md',
      title: 'Document 1',
      description: 'First document',
    });
    expect(result.documents).toContainEqual({
      documentUri: 'documents://test-collection/doc2.md',
      title: 'Document 2',
      description: undefined,
    });
    expect(result.documents).toContainEqual({
      documentUri: 'documents://another-collection/doc3.md',
      title: 'Document 3',
      description: 'Third document',
    });
  });

  it('should filter by collection key', async () => {
    vol.fromJSON({
      '/output/test-collection/doc1.md': `---
title: Document 1
---
# Content 1`,
      '/output/another-collection/doc2.md': `---
title: Document 2
---
# Content 2`,
    });

    const result = await mcpListDocuments(
      { collectionKey: 'test-collection' },
      mockCollections,
    );

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toEqual({
      documentUri: 'documents://test-collection/doc1.md',
      title: 'Document 1',
      description: undefined,
    });
  });

  it('should throw error for non-existent collection key', async () => {
    await expect(
      mcpListDocuments({ collectionKey: 'non-existent' }, mockCollections),
    ).rejects.toThrow("Collection with key 'non-existent' not found");
  });

  it('should filter by prefix', async () => {
    vol.fromJSON({
      '/output/test-collection/subdir/index.md': `---
title: Subdirectory Index
---
# Index`,
      '/output/test-collection/subdir/doc1.md': `---
title: Subdirectory Document
---
# Content`,
      '/output/test-collection/doc2.md': `---
title: Root Document
---
# Content`,
      '/output/test-collection/other/index.md': `---
title: Other Index
---
# Index`,
      '/output/test-collection/other/doc3.md': `---
title: Other Document
---
# Content`,
      '/output/another-collection/.gitkeep': '',
    });

    const result = await mcpListDocuments(
      { prefix: 'subdir/' },
      mockCollections,
    );

    expect(result.documents).toHaveLength(2);
    expect(result.documents.map((d) => d.title)).toEqual(
      expect.arrayContaining(['Subdirectory Index', 'Subdirectory Document']),
    );
  });

  it('should filter by single keyword', async () => {
    vol.fromJSON({
      '/output/test-collection/doc1.md': `---
title: API Documentation
description: Guide for REST API
---
# API Reference`,
      '/output/test-collection/doc2.md': `---
title: User Guide
description: Getting started
---
# Welcome to the guide`,
      '/output/test-collection/doc3.md': `---
title: API Tutorial
---
# Learning the API`,
    });

    const result = await mcpListDocuments({ keywords: 'API' }, mockCollections);

    expect(result.documents).toHaveLength(2);
    expect(result.documents.map((d) => d.title)).toEqual(
      expect.arrayContaining(['API Documentation', 'API Tutorial']),
    );
  });

  it('should filter by multiple keywords (all must match)', async () => {
    vol.fromJSON({
      '/output/test-collection/doc1.md': `---
title: React Component Guide
description: Building custom components
---
# React components and hooks`,
      '/output/test-collection/doc2.md': `---
title: React Tutorial
description: Learn React basics
---
# Getting started with components`,
      '/output/test-collection/doc3.md': `---
title: Vue Guide
description: Vue components
---
# Vue component system`,
    });

    const result = await mcpListDocuments(
      { keywords: 'React components' },
      mockCollections,
    );

    expect(result.documents).toHaveLength(2);
    expect(result.documents.map((d) => d.title)).toEqual(
      expect.arrayContaining(['React Component Guide', 'React Tutorial']),
    );
  });

  it('should handle keywords with extra spaces', async () => {
    vol.fromJSON({
      '/output/test-collection/doc1.md': `---
title: Test Document
---
# Content with multiple words`,
    });

    const result = await mcpListDocuments(
      { keywords: '  Test   multiple  ' },
      mockCollections,
    );

    expect(result.documents).toHaveLength(1);
  });

  it('should apply multiple filters together', async () => {
    vol.fromJSON({
      '/output/test-collection/api/index.md': `---
title: API Documentation
---
# API Docs`,
      '/output/test-collection/api/rest.md': `---
title: REST API Guide
description: RESTful service documentation
---
# REST API endpoints`,
      '/output/test-collection/api/graphql.md': `---
title: GraphQL API
description: GraphQL schema and queries
---
# GraphQL documentation`,
      '/output/test-collection/guides/index.md': `---
title: Guides
---
# Guides`,
      '/output/test-collection/guides/intro.md': `---
title: Introduction
description: Getting started guide
---
# Welcome`,
      '/output/another-collection/api/index.md': `---
title: API
---
# API`,
      '/output/another-collection/api/soap.md': `---
title: SOAP API
description: Legacy SOAP services
---
# SOAP endpoints`,
    });

    const result = await mcpListDocuments(
      {
        collectionKey: 'test-collection',
        prefix: 'api/',
        keywords: 'REST',
      },
      mockCollections,
    );

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toEqual({
      documentUri: 'documents://test-collection/api/rest.md',
      title: 'REST API Guide',
      description: 'RESTful service documentation',
    });
  });

  it('should return empty array when no documents match', async () => {
    vol.fromJSON({
      '/output/test-collection/doc1.md': `---
title: Document 1
---
# Content`,
    });

    const result = await mcpListDocuments(
      { keywords: 'nonexistent' },
      mockCollections,
    );

    expect(result.documents).toHaveLength(0);
  });

  it('should handle nested directory structures', async () => {
    vol.fromJSON({
      '/output/test-collection/docs/index.md': `---
title: Docs Index
---
# Documentation`,
      '/output/test-collection/docs/api/index.md': `---
title: API Index
---
# API Documentation`,
      '/output/test-collection/docs/api/endpoints.md': `---
title: API Endpoints
---
# Endpoint Reference`,
    });

    const result = await mcpListDocuments(
      { prefix: 'docs/api/' },
      mockCollections,
    );

    expect(result.documents).toHaveLength(2);
    expect(result.documents.map((d) => d.title)).toEqual(
      expect.arrayContaining(['API Index', 'API Endpoints']),
    );
  });
});
