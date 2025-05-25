# Coding Guidelines for outline-sync

This document outlines the coding standards and conventions used in the outline-sync project. These guidelines ensure consistency and help maintain high code quality.

## Project Overview

**outline-sync** is a bidirectional synchronization tool that enables 2-way sync between Outline (a documentation/wiki platform) and your local filesystem. It also includes MCP (Model Context Protocol) support for AI assistant integration.

### Key Features

- Downloads documentation from Outline to local markdown files
- Uploads local markdown changes back to Outline
- Handles embedded images (download/upload)
- Preserves document hierarchy and metadata
- Supports selective sync with collection filtering
- MCP server for AI assistant integration

## Project Structure

- **Single Package**: Not a monorepo, but follows similar conventions
- **Package Manager**: pnpm 10+ (enforced via `only-allow` preinstall hook)
- **Node Version**: 20+ (specified in engines, Volta pinned to 22.16.0)
- **Module System**: ESM only (`"type": "module"` in package.json)

## Code Structure

### Directory Organization

```
src/
├── commands/           # CLI command implementations
│   ├── download.ts     # Downloads collections from Outline to local files
│   ├── upload.ts       # Uploads local changes back to Outline
│   └── mcp.ts          # Starts MCP server for AI integration
│
├── services/           # Core business logic
│   ├── outline.ts      # Main Outline API client using OpenAPI types
│   ├── documents.ts    # Document fetching with hierarchy building
│   ├── attachments.ts  # Image/attachment handling and markdown processing
│   ├── output-files.ts # File system operations for collections
│   └── generated/      # OpenAPI TypeScript definitions
│
├── mcp/               # Model Context Protocol server
│   ├── server.ts      # MCP server implementation (stdio/SSE transports)
│   ├── resources/     # MCP resource handlers for document access
│   └── types.ts       # MCP-specific type definitions
│
├── types/             # TypeScript type definitions
│   ├── config.ts      # Configuration schemas using Zod validation
│   ├── documents.ts   # Document-related types
│   ├── collections.ts # Collection types
│   └── index.ts       # Type re-exports
│
├── utils/             # Utility functions
│   ├── config.ts      # Configuration loading and validation
│   ├── file-manager.ts # File system operations (safe filenames, frontmatter)
│   ├── file-transfer.ts # HTTP file upload/download utilities
│   ├── collection-filter.ts # Collection filtering logic
│   └── version.ts     # Version management
│
├── constants/         # Application constants
│   └── concurrency.ts # Concurrency limits for API requests
│
└── index.ts           # Main entry point with CLI setup
```

### Key Workflows

1. **Download Flow**:

   - Fetches collections from Outline API
   - Builds document hierarchy recursively
   - Downloads document content and embedded images
   - Writes markdown files with frontmatter metadata

2. **Upload Flow**:

   - Scans local markdown files
   - Parses frontmatter to identify documents
   - Uploads new images to Outline
   - Creates or updates documents via API

3. **MCP Integration**:
   - Provides AI assistants with direct access to synced documentation
   - Supports stdio and SSE transports
   - Exposes document resources through standardized protocol

### Configuration

The project uses a JSON-based configuration file with Zod validation:

- `outline-sync.config.json` - Main configuration file
- Supports collection filtering, output directories, and sync behavior
- Environment variables can override config values

## File Naming Conventions

- **Files**: Use kebab-case for all file names (e.g., `system-info.ts`, `eslint.config.js`)
- **Directories**: Use kebab-case for directory names
- **Test Files**: Use descriptive suffixes:
  - `.unit.test.ts` for unit tests
  - `.int.test.ts` for integration tests
  - Tests should be collocated with source files in the same directory

## Import/Export Rules

### ESM-Style Imports

- **Always use .js extensions** in import statements, even when importing TypeScript files
- Example: `import { getSystemInfo } from '@src/system-info.js';`
- This is required for proper ESM module resolution with TypeScript's `NodeNext` module resolution

### Import Organization

Imports must be sorted according to perfectionist rules in this order:

1. Type imports
2. Built-in and external value imports
3. Internal type imports
4. Internal value imports (using `@src/` pattern)
5. Relative type imports (parent, sibling, index)
6. Relative value imports (parent, sibling, index)
7. Side-effect imports

### Type Imports

- Use `import type` for type-only imports: `import type { MyType } from './types.js';`
- Use consistent type exports: `export type { MyType };`

## TypeScript Rules

### Function Return Types

- **Always specify explicit return types** for functions (enforced by `@typescript-eslint/explicit-function-return-type`)
- Exceptions: Expression functions and typed function expressions are allowed
- Example:

  ```typescript
  export function getSystemInfo(): SystemInfo {
    // implementation
  }

  function displaySystemInfo(): void {
    // implementation
  }
  ```

### General TypeScript Rules

- Use strict type checking configuration
- Enable `isolatedModules` for faster compilation
- Use `NodeNext` module resolution
- Prefer destructuring for objects (not arrays)
- Use consistent type imports/exports

## Testing with Vitest

### Configuration

- **No globals**: Import test functions explicitly from 'vitest'
- Example: `import { describe, expect, it } from 'vitest';`
- Tests run from `./src` root directory
- Mock reset enabled by default

### Test Structure

```typescript
import { describe, expect, it } from 'vitest';
import { getSystemInfo } from '@src/system-info.js';

describe('getSystemInfo', () => {
  it('should return a platform', () => {
    const systemInfo = getSystemInfo();
    expect(systemInfo.platform).toBeTruthy();
  });
});
```

## Code Style Rules

### General JavaScript/TypeScript

- **Object shorthand**: Always use shorthand syntax for object properties
- **Template literals**: Prefer template literals over string concatenation
- **Arrow functions**: Use concise arrow function syntax when possible

### Import Rules

- No extraneous dependencies (must be in package.json)
- Dev dependencies allowed in:
  - Test files (`**/*.test.{js,ts,tsx,jsx}`)
  - Test helpers (`**/*.test-helper.{js,ts,jsx,tsx}`)
  - Config files at root level (`*.{js,ts,mjs,mts,cjs,cts}`)
  - Test directories (`src/tests/**/*`, `**/__mocks__/**/*`)

### Unicorn Rules (Selected)

- Abbreviations are allowed in identifiers
- `null` values are permitted
- Array callback references are allowed

## Development Commands

Essential commands for maintaining code quality:

```bash
# Install dependencies (pnpm enforced)
pnpm install

# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Run tests
pnpm test

# Run Prettier formatting
pnpm prettier:check
pnpm prettier:write

# Build project
pnpm build
```

## Key Reminders for Claude Code

- Always use `.js` extensions in imports, even for TypeScript files
- Specify explicit return types on all functions
- Use kebab-case for file names
- Import test functions from 'vitest' (no globals)
- Collocate tests with source files using `.unit.test.ts` or `.int.test.ts` suffixes
- Run `pnpm lint` and `pnpm typecheck` before committing changes
- If a particular interface or type is not exported, change the file so it is exported.
- Keep tests simple and focused and try to extract repeated logic into helper functions.
- Apply a reasonable number of tests but
- If you are adding a new feature, please also add a new Changeset for it in the `.changeset/` directory of the form keeping things to patch changes for now:

  ```
  ---
  'outline-sync': <patch|minor|major>
  ---

  <description of the feature or change>
  ```

- IMPORTANT: If you have to go through more than one cycle of edits to fix linting, type, or test errors, please stop and ask for help. Often fixing errors will cause worse changes so it's better to ask for help than to continue. Feel free to ask for help at any time for any issues.

# Testing

- To mock the file system, simply add:

```
vi.mock('node:fs/promises');
vi.mock('node:fs');
```
