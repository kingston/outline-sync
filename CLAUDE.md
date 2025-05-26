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
- **Package Manager**: pnpm 10+
- **Node Version**: 20+ (specified in engines, Volta pinned to 22.16.0)
- **Module System**: ESM only (`"type": "module"` in package.json)

## Code Structure

### Directory Organization

```
src/
├── commands/           # CLI command implementations
│   ├── annotate.ts     # Annotates markdown files with AI-generated descriptions
│   ├── download.ts     # Downloads collections from Outline to local files
│   ├── mcp.ts          # Starts MCP server for AI integration
│   └── upload.ts       # Uploads local changes back to Outline
│
├── services/           # Core business logic
│   ├── attachments.ts  # Image/attachment handling and markdown processing
│   ├── documents.ts    # Document fetching with hierarchy building
│   ├── langchain.ts    # LangChain integration for AI features
│   ├── outline.ts      # Main Outline API client using OpenAPI types
│   ├── output-files.ts # File system operations for collections
│   └── generated/      # OpenAPI TypeScript definitions
│       └── outline-openapi.d.ts
│
├── mcp/               # Model Context Protocol server
│   ├── server.ts      # MCP server implementation (stdio/SSE transports)
│   ├── resources/     # MCP resource handlers
│   │   ├── documents.ts # Document resource access
│   │   └── index.ts   # Resource exports
│   ├── tools/         # MCP tool implementations
│   │   ├── index.ts   # Tool exports
│   │   └── list-collections.ts # List available collections
│   ├── types.ts       # MCP-specific type definitions
│   └── utils/         # MCP test utilities
│       └── mcp-runner.test-helper.ts # MCP test runner
│
├── types/             # TypeScript type definitions
│   ├── collections.ts # Collection types
│   ├── config.ts      # Configuration schemas using Zod validation
│   ├── documents.ts   # Document-related types
│   └── index.ts       # Type re-exports
│
├── utils/             # Utility functions
│   ├── collection-filter.ts # Collection filtering logic
│   ├── config.ts      # Configuration loading and validation
│   ├── file-manager.ts # File system operations (frontmatter handling)
│   ├── file-names.ts  # Safe filename generation
│   ├── file-transfer.ts # HTTP file upload/download utilities
│   ├── find-nearest-package-json.ts # Package.json location utility
│   ├── handle-not-found-error.ts # Error handling utilities
│   └── version.ts     # Version management
│
├── tests/             # Test utilities and helpers
│   ├── config.test-helper.ts # Configuration mock helpers
│   └── factories.test-helper.ts # Test data factories
│
├── constants/         # Application constants
│   └── concurrency.ts # Concurrency limits for API requests
│
├── __mocks__/         # Manual mocks for testing
│   ├── fs.cts         # File system mocks
│   └── fs/
│       └── promises.cts # Async file system mocks
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

## Test Organization

- Unit tests are colocated with source files using `.unit.test.ts` suffix
- Integration tests use `.int.test.ts` suffix
- Test helpers are located in `src/tests/` directory
- Manual mocks are in `src/__mocks__/` directory

## Common Test Patterns

### Mocking the File System

For file system operations, use memfs:

```typescript
import { vol } from 'memfs';

vi.mock('node:fs');
vi.mock('node:fs/promises');

beforeEach(() => {
  vol.reset();
});

afterEach(() => {
  vol.reset();
});
```

### Test Data Factories

Use factory functions from `@src/tests/factories.test-helper.js`:

```typescript
import {
  createMockDocument,
  createMockDocumentCollection,
  createMockParsedDocument,
} from '@src/tests/factories.test-helper.js';
```

### Mocking External Dependencies

Always mock external dependencies like ora, chalk, etc.:

```typescript
vi.mock('ora');
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
  },
}));
```

### Type-Safe Mocking

Use proper TypeScript types for mocks:

```typescript
import type { Mocked } from 'vitest';

let mockOutlineService: Mocked<{
  getCollections: typeof OutlineService.prototype.getCollections;
  // ... other methods
}>;
```

### MCP Testing

For MCP tools, use the test runner helper:

```typescript
import { setupMcpTest } from '../utils/mcp-runner.test-helper.js';

const mcpContext = await setupMcpTest({
  config: mockConfig,
  collections: mockCollections,
});

const result = await mcpContext.callMcpTool({
  name: 'list-collections',
  arguments: {},
});
```

## Testing Best Practices

1. **Clear Test Names**: Use descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases
3. **Mock External Services**: Always mock external API calls and file system operations
4. **Use Test Helpers**: Extract common setup code into test helpers
5. **Test Error Cases**: Include tests for error conditions and edge cases
6. **Avoid Test Interdependence**: Each test should be independent and not rely on others
7. **Clean Up After Tests**: Always reset mocks and clean up resources in afterEach
8. **Use Type-Safe Mocks**: Leverage TypeScript for type-safe mocking
9. **Test Public APIs**: Focus on testing public methods and behaviors, not implementation details
10. **Keep Tests Simple**: Each test should verify one specific behavior
