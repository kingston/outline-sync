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

/**
 * Construct an Outline document URL from API URL, title, and urlId
 * @param apiUrl - The Outline API URL (e.g., 'https://app.getoutline.com/api')
 * @param title - The document title
 * @param urlId - The document's URL ID
 * @returns The full Outline document URL
 */
export function constructOutlineUrl(
  apiUrl: string,
  title: string,
  urlId: string,
): string {
  // Convert API URL to base URL by removing '/api' suffix
  const baseUrl = apiUrl.replace(/\/api$/, '');
  const titleSlug = createSafeFilename(title);
  return `${baseUrl}/doc/${titleSlug}-${urlId}`;
}
