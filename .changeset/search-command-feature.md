---
'outline-sync': patch
---

Add search command to find documents across Outline collections using semantic search

- New `search` command that indexes and searches documents using vector embeddings
- Supports filtering by collection and limiting results
- Option to include document contents in search results
- Uses FAISS for efficient similarity search with LangChain integration
