import { describe, expect, it } from 'vitest';

import type {
  AttachmentInfo,
  ImageUploadInfo,
} from '@src/services/attachments.js';

import {
  parseAttachments,
  parseRelativeImages,
  transformMarkdownImages,
  transformMarkdownToAttachments,
} from '@src/services/attachments.js';

describe('parseAttachments', () => {
  it('should parse a single attachment without annotations', () => {
    const content =
      '![Caption](/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000)';
    const result = parseAttachments(content);

    expect(result).toEqual([
      {
        id: '123e4567-e89b-4d3c-a456-426614174000',
        caption: 'Caption',
        originalUrl:
          '/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000',
      },
    ]);
  });

  it('should parse multiple attachments', () => {
    const content = `
![First Image](/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000)
Some text in between
![Second Image](/api/attachments.redirect?id=987f6543-a21b-4d3c-b456-426614174111)
    `;
    const result = parseAttachments(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: '123e4567-e89b-4d3c-a456-426614174000',
      caption: 'First Image',
    });
    expect(result[1]).toMatchObject({
      id: '987f6543-a21b-4d3c-b456-426614174111',
      caption: 'Second Image',
    });
  });

  it('should parse attachments with annotations', () => {
    const content =
      '![Caption](/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000 =300x200)';
    const result = parseAttachments(content);

    expect(result).toEqual([
      {
        id: '123e4567-e89b-4d3c-a456-426614174000',
        caption: 'Caption',
        originalUrl:
          '/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000 =300x200',
        annotations: ' =300x200',
      },
    ]);
  });

  it('should handle empty captions', () => {
    const content =
      '![](/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000)';
    const result = parseAttachments(content);

    expect(result[0].caption).toBe('');
  });

  it('should return empty array when no attachments found', () => {
    const content = 'Just some regular text with no images';
    const result = parseAttachments(content);

    expect(result).toEqual([]);
  });
});

describe('parseRelativeImages', () => {
  it('should parse a simple relative image', () => {
    const content = '![Alt text](./image.png)';
    const result = parseRelativeImages(content);

    expect(result).toEqual([
      {
        caption: 'Alt text',
        relativePath: 'image.png',
        isExistingAttachment: false,
        annotations: undefined,
      },
    ]);
  });

  it('should detect UUID-based filenames as existing attachments', () => {
    const content = '![Caption](./123e4567-e89b-4d3c-a456-426614174000.png)';
    const result = parseRelativeImages(content);

    expect(result).toEqual([
      {
        caption: 'Caption',
        relativePath: '123e4567-e89b-4d3c-a456-426614174000.png',
        isExistingAttachment: true,
        attachmentId: '123e4567-e89b-4d3c-a456-426614174000',
        annotations: undefined,
      },
    ]);
  });

  it('should parse images with nested paths', () => {
    const content = '![Description](./images/subfolder/test.jpg)';
    const result = parseRelativeImages(content);

    expect(result).toEqual([
      {
        caption: 'Description',
        relativePath: 'images/subfolder/test.jpg',
        isExistingAttachment: false,
        annotations: undefined,
      },
    ]);
  });

  it('should parse images with annotations', () => {
    const content = '![Caption](./image.png =500x300)';
    const result = parseRelativeImages(content);

    expect(result).toEqual([
      {
        caption: 'Caption',
        relativePath: 'image.png',
        isExistingAttachment: false,
        annotations: ' =500x300',
      },
    ]);
  });

  it('should parse multiple images', () => {
    const content = `
![First](./first.png)
![Second](./987f6543-a21b-4d3c-b456-426614174111.jpg =100x100)
    `;
    const result = parseRelativeImages(content);

    expect(result).toHaveLength(2);
    expect(result[0].relativePath).toBe('first.png');
    expect(result[0].isExistingAttachment).toBe(false);
    expect(result[1].relativePath).toBe(
      '987f6543-a21b-4d3c-b456-426614174111.jpg',
    );
    expect(result[1].isExistingAttachment).toBe(true);
    expect(result[1].annotations).toBe(' =100x100');
  });

  it('should return empty array when no relative images found', () => {
    const content = 'No images here';
    const result = parseRelativeImages(content);

    expect(result).toEqual([]);
  });
});

describe('transformMarkdownImages', () => {
  it('should transform attachment URLs to local paths', () => {
    const content =
      '![Caption](/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000)';
    const attachments: AttachmentInfo[] = [
      {
        id: '123e4567-e89b-4d3c-a456-426614174000',
        caption: 'Caption',
        originalUrl:
          '/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000',
        localPath: 'docs/images/image.png',
      },
    ];
    const documentPath = 'docs';

    const result = transformMarkdownImages(content, attachments, documentPath);

    expect(result).toBe('![Caption](./images/image.png)');
  });

  it('should handle multiple attachments', () => {
    const content = `
![First](/api/attachments.redirect?id=111)
Some text
![Second](/api/attachments.redirect?id=222)
    `;
    const attachments: AttachmentInfo[] = [
      {
        id: '111',
        caption: 'First',
        originalUrl: '/api/attachments.redirect?id=111',
        localPath: 'docs/images/first.png',
      },
      {
        id: '222',
        caption: 'Second',
        originalUrl: '/api/attachments.redirect?id=222',
        localPath: 'docs/images/second.jpg',
      },
    ];
    const documentPath = 'docs';

    const result = transformMarkdownImages(content, attachments, documentPath);

    expect(result).toContain('![First](./images/first.png)');
    expect(result).toContain('![Second](./images/second.jpg)');
  });

  it('should preserve annotations when transforming', () => {
    const content = '![Caption](/api/attachments.redirect?id=123 =300x200)';
    const attachments: AttachmentInfo[] = [
      {
        id: '123',
        caption: 'Caption',
        originalUrl: '/api/attachments.redirect?id=123 =300x200',
        localPath: 'docs/image.png',
        annotations: ' =300x200',
      },
    ];
    const documentPath = 'docs';

    const result = transformMarkdownImages(content, attachments, documentPath);

    expect(result).toBe('![Caption](./image.png =300x200)');
  });

  it('should handle paths that require parent directory traversal', () => {
    const content = '![Caption](/api/attachments.redirect?id=123)';
    const attachments: AttachmentInfo[] = [
      {
        id: '123',
        caption: 'Caption',
        originalUrl: '/api/attachments.redirect?id=123',
        localPath: 'images/shared/image.png',
      },
    ];
    const documentPath = 'docs/subfolder';

    const result = transformMarkdownImages(content, attachments, documentPath);

    expect(result).toBe('![Caption](../../images/shared/image.png)');
  });

  it('should return content unchanged if no attachments provided', () => {
    const content = 'Some content with no images';
    const attachments: AttachmentInfo[] = [];
    const documentPath = 'docs';

    const result = transformMarkdownImages(content, attachments, documentPath);

    expect(result).toBe(content);
  });
});

describe('transformMarkdownToAttachments', () => {
  it('should transform existing attachment references back to URLs', () => {
    const content = '![Caption](./123e4567-e89b-4d3c-a456-426614174000.png)';
    const images: ImageUploadInfo[] = [
      {
        caption: 'Caption',
        relativePath: '123e4567-e89b-4d3c-a456-426614174000.png',
        isExistingAttachment: true,
        attachmentId: '123e4567-e89b-4d3c-a456-426614174000',
      },
    ];

    const result = transformMarkdownToAttachments(content, images);

    expect(result).toBe(
      '![Caption](/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000)',
    );
  });

  it('should preserve annotations during transformation', () => {
    const content =
      '![Caption](./123e4567-e89b-4d3c-a456-426614174000.png =400x300)';
    const images: ImageUploadInfo[] = [
      {
        caption: 'Caption',
        relativePath: '123e4567-e89b-4d3c-a456-426614174000.png',
        isExistingAttachment: true,
        attachmentId: '123e4567-e89b-4d3c-a456-426614174000',
        annotations: ' =400x300',
      },
    ];

    const result = transformMarkdownToAttachments(content, images);

    expect(result).toBe(
      '![Caption](/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000 =400x300)',
    );
  });

  it('should not transform non-attachment images', () => {
    const content = '![Regular Image](./regular-image.png)';
    const images: ImageUploadInfo[] = [
      {
        caption: 'Regular Image',
        relativePath: 'regular-image.png',
        isExistingAttachment: false,
      },
    ];

    const result = transformMarkdownToAttachments(content, images);

    expect(result).toBe(content);
  });

  it('should handle mixed image types', () => {
    const content = `
![Regular](./regular.png)
![Attachment](./123e4567-e89b-4d3c-a456-426614174000.jpg)
![Another Regular](./another.gif)
    `;
    const images: ImageUploadInfo[] = [
      {
        caption: 'Regular',
        relativePath: 'regular.png',
        isExistingAttachment: false,
      },
      {
        caption: 'Attachment',
        relativePath: '123e4567-e89b-4d3c-a456-426614174000.jpg',
        isExistingAttachment: true,
        attachmentId: '123e4567-e89b-4d3c-a456-426614174000',
      },
      {
        caption: 'Another Regular',
        relativePath: 'another.gif',
        isExistingAttachment: false,
      },
    ];

    const result = transformMarkdownToAttachments(content, images);

    expect(result).toContain('![Regular](./regular.png)');
    expect(result).toContain(
      '![Attachment](/api/attachments.redirect?id=123e4567-e89b-4d3c-a456-426614174000)',
    );
    expect(result).toContain('![Another Regular](./another.gif)');
  });

  it('should return content unchanged if no images provided', () => {
    const content = 'Content with no images';
    const images: ImageUploadInfo[] = [];

    const result = transformMarkdownToAttachments(content, images);

    expect(result).toBe(content);
  });
});
