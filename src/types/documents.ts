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
  parentDocumentId?: string;
  collectionId: string;
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
