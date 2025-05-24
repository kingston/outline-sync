import path from 'node:path';

// Regex to match attachment URLs in markdown (including optional annotations like dimensions)
const ATTACHMENT_REGEX =
  /!\[([^\]]*)\]\(\/api\/attachments\.redirect\?id=([a-f0-9-]+)([^)]*)\)/g;

// Regex to match relative image paths (including optional annotations)
const RELATIVE_IMAGE_REGEX = /!\[([^\]]*)\]\(\.\/([^)\s]+)([^)]*)\)/g;

// UUID v4 regex pattern
const UUID_REGEX =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export interface AttachmentInfo {
  id: string;
  caption: string;
  originalUrl: string;
  localPath: string;
  annotations?: string;
}

export interface ImageUploadInfo {
  caption: string;
  relativePath: string;
  isExistingAttachment: boolean;
  attachmentId?: string;
  annotations?: string;
}

/**
 * Parse markdown content to find all attachment references
 */
export function parseAttachments(
  content: string,
): Omit<AttachmentInfo, 'localPath'>[] {
  const attachments: Omit<AttachmentInfo, 'localPath'>[] = [];
  let match;

  while ((match = ATTACHMENT_REGEX.exec(content)) !== null) {
    const annotations = match[3];
    attachments.push({
      id: match[2],
      caption: match[1],
      originalUrl: match[0].slice(
        match[0].indexOf('(') + 1,
        match[0].lastIndexOf(')'),
      ),
      annotations: annotations || undefined,
    });
  }

  return attachments;
}

/**
 * Parse markdown content to find all relative image references
 */
export function parseRelativeImages(content: string): ImageUploadInfo[] {
  const images: ImageUploadInfo[] = [];
  let match;

  while ((match = RELATIVE_IMAGE_REGEX.exec(content)) !== null) {
    const relativePath = match[2];
    const annotations = match[3];
    const filename = relativePath.split('/').pop() ?? '';
    const nameWithoutExt = filename.slice(0, filename.lastIndexOf('.'));

    // Check if filename is a UUID (existing attachment)
    const isExistingAttachment = UUID_REGEX.test(nameWithoutExt);

    images.push({
      caption: match[1],
      relativePath,
      isExistingAttachment,
      attachmentId: isExistingAttachment ? nameWithoutExt : undefined,
      annotations: annotations || undefined,
    });
  }

  return images;
}

/**
 * Transform markdown content to use local image paths
 */
export function transformMarkdownImages(
  content: string,
  attachments: AttachmentInfo[],
  documentPath: string,
): string {
  let transformed = content;

  for (const attachment of attachments) {
    const localPath = path.posix.relative(documentPath, attachment.localPath);
    const relativePath = localPath.startsWith('.')
      ? localPath
      : `./${localPath}`;
    const originalPattern = `![${attachment.caption}](${attachment.originalUrl})`;
    const replacement = `![${attachment.caption}](${relativePath}${attachment.annotations ?? ''})`;
    transformed = transformed.replace(originalPattern, replacement);
  }

  return transformed;
}

/**
 * Transform markdown content to use attachment URLs
 */
export function transformMarkdownToAttachments(
  content: string,
  images: ImageUploadInfo[],
): string {
  let transformed = content;

  for (const image of images) {
    if (image.isExistingAttachment && image.attachmentId) {
      const originalPattern = `![${image.caption}](./${image.relativePath}${image.annotations ?? ''})`;
      const replacement = `![${image.caption}](/api/attachments.redirect?id=${image.attachmentId}${image.annotations ?? ''})`;
      transformed = transformed.replace(originalPattern, replacement);
    }
  }

  return transformed;
}
