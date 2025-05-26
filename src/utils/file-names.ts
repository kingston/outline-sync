import slugify from 'slugify';

/**
 * Create a filesystem-safe filename from a document title
 */
export function createSafeFilename(title: string): string {
  return slugify.default(title, {
    lower: true,
    strict: true,
    replacement: '-',
  });
}

/**
 * Create a filesystem-safe filename for a markdown file
 * @param title - The title of the document
 * @returns The filesystem-safe filename for the markdown file
 */
export function createSafeMarkdownFilename(title: string): string {
  return `${createSafeFilename(title)}.md`;
}
