---
'outline-sync': patch
---

Add MCP tools for document retrieval and listing, and RAG search capabilities

- Add `get-document` tool to retrieve full document content by URI
- Add `list-documents` tool to list documents with optional filtering by collection, prefix path, or keywords
- Add `rag-search` CLI command for searching document chunks using RAG (Retrieval-Augmented Generation)
- Add `search-rag-documents` MCP tool for finding specific passages within documents using semantic similarity
