export interface MCPTool<TParams = unknown, TResult = unknown> {
  definition: {
    name: string;
    description: string;
    inputSchema: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
  handler: (params: TParams, ...args: unknown[]) => Promise<TResult>;
}

export interface ListDocumentsParams {
  collection?: string;
  search?: string;
  limit?: number;
}

export interface ListDocumentsResult {
  collections: {
    name: string;
    documents: {
      path: string;
      title: string;
      outlineId?: string;
    }[];
  }[];
}

export interface ReadDocumentParams {
  path: string;
  includeMetadata?: boolean;
}

export interface ReadDocumentResult {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDocumentParams {
  path: string;
  content: string;
  preserveMetadata?: boolean;
}

export interface UpdateDocumentResult {
  success: boolean;
  path: string;
}

export interface SearchDocumentsParams {
  query: string;
  collection?: string;
  includeContent?: boolean;
}

export interface SearchDocumentsResult {
  results: {
    path: string;
    title: string;
    matches: number;
    preview?: string;
  }[];
}

export interface SyncParams {
  direction: 'download' | 'upload';
  collection?: string;
}

export interface SyncResult {
  success: boolean;
  direction: string;
  message?: string;
}
