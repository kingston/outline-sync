---
'outline-sync': patch
---

Update dependencies to fix security advisories, including LangChain 1.x (`@langchain/community`, `@langchain/core`, `@langchain/textsplitters`). The optional peer dependencies `@langchain/anthropic`, `@langchain/google-genai` and `@langchain/openai` now require their 1.x/2.x releases, and MCP tools and resources use the non-deprecated `registerTool`/`registerResource` API.
