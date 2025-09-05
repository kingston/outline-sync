import z from 'zod';

export const documentFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  sidebar: z
    .object({
      order: z.number().optional(),
    })
    .optional(),
  outlineId: z.string().optional(),
  urlId: z.string().optional(),
});

/**
 * Frontmatter metadata for downloaded documents
 */
export type DocumentFrontmatter = z.infer<typeof documentFrontmatterSchema>;

/**
 * Document information from the Outline API
 */
export interface Document {
  id: string;
  urlId: string;
  title: string;
  description?: string;
  collectionId: string;
  parentDocumentId?: string;
  text: string;
}

export interface DocumentWithOrder extends Document {
  /**
   * The order of the document in the collection
   */
  order: number;
}

/**
 * Parsed document with content and metadata
 */
export interface ParsedDocument {
  metadata: DocumentFrontmatter;
  content: string;
  filePath: string;
  relativePath: string;
  parentDocumentId?: string;
  collectionId: string;
  /**
   * The relative index of the document in the collection or parent directory.
   */
  relativeIndex: number;
  /**
   * The last modified date of the document
   */
  lastModifiedAt: Date;
}

/**
 * Document hierarchy for organizing downloads
 */
export interface DocumentHierarchy {
  id: string;
  title: string;
  parentId?: string;
  children: DocumentHierarchy[];
  document: DocumentWithOrder;
}

/**
 * Document with children for recursive processing
 */
export interface DocumentWithChildren extends Document {
  children: DocumentWithChildren[];
}
