# outline-sync

## 0.2.3

### Patch Changes

- 53ca86b: Add MCP tools for document retrieval and listing, and RAG search capabilities

  - Add `get-document` tool to retrieve full document content by URI
  - Add `list-documents` tool to list documents with optional filtering by collection, prefix path, or keywords
  - Add `rag-search` CLI command for searching document chunks using RAG (Retrieval-Augmented Generation)
  - Add `search-rag-documents` MCP tool for finding specific passages within documents using semantic similarity

## 0.2.2

### Patch Changes

- 8939191: Ensure MCP stdio does not emit any additional output and add overrides to mcp command

## 0.2.1

### Patch Changes

- ab90a91: Fix pathing aliases with tsc-alias
- 2dda40f: Remove pnpm preinstall hook

## 0.2.0

### Minor Changes

- cee2633: Refactor getCollectionConfigs API and CLI commands

  - Updated `getCollectionConfigs` to use a more logical API with an `overrides` parameter object instead of positional arguments
  - Changed all CLI commands to use consistent named options:
    - `-c, --collections <ids...>` for filtering collections by URL IDs
    - `-d, --dir <directory>` for overriding the output/source directory
  - Removed all deprecated command options for a cleaner API
  - Added proper TypeScript interfaces for command options: `DownloadOptions`, `UploadOptions`, `McpOptions`, and `AnnotateOptions`

### Patch Changes

- e2ae99a: Add MCP create-document tool for creating new local document files
- 913104f: Add MCP edit-document tool for editing local document files (title, description, content)
- dc801d2: Add MCP inline-edit tool for performing find-replace operations on local document files
- 6493ede: Add MCP tool to list available collections for AI assistants
- 57fe6ae: Add search command to find documents across Outline collections using semantic search

  - New `search` command that indexes and searches documents using vector embeddings
  - Supports filtering by collection and limiting results
  - Option to include document contents in search results
  - Uses FAISS for efficient similarity search with LangChain integration
