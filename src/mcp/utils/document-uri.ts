export const DOCUMENT_URI_REGEX = /^documents:\/\/([^/]+)\/(.*)$/;

/**
 * Parse a document URI into its collection key and document path
 *
 * @param uri - The document URI to parse
 * @returns The collection key and document path
 */
export function parseDocumentUri(uri: string): {
  collectionKey: string;
  documentPath: string;
} {
  const match = DOCUMENT_URI_REGEX.exec(uri);
  if (!match) {
    throw new Error(`Invalid document URI: ${uri}`);
  }
  return { collectionKey: match[1], documentPath: match[2] };
}
