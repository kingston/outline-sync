---
title: Typescript Rendering System
outlineId: 675c0411-12e1-4987-b6c4-479b0e333c07
sidebar:
  order: 2
---
The TypeScript Rendering System is a powerful code generation framework in Baseplate that enables generators to create TypeScript code files with proper imports, formatting, and structure. This system provides abstractions for creating, manipulating, and composing TypeScript code fragments, which can then be rendered into complete source files.

## Core Concepts

### TsCodeFragment

A `TsCodeFragment` is the fundamental unit of code generation, representing a piece of TypeScript code with associated imports and any fragments that should be hoisted to specific positions in the file:

```typescript
interface TsCodeFragment {
  contents: string;             // The actual TypeScript code
  imports?: TsImportDeclaration[]; // Import declarations this code requires
  hoistedFragments?: TsHoistedFragment[]; // Additional code to place at specific positions
}
```

### Templates

Templates are pre-defined TypeScript files with variable placeholders that can be filled in during rendering:

```typescript
interface TsCodeFileTemplate<TVariables extends TsCodeTemplateVariableMap> {
  name: string;                 // Template identifier
  variables: TVariables;        // Variable definitions
  source: TsCodeFileTemplateSource; // Template source (path or contents)
  prefix?: string;              // Variable prefix (default: 'TPL_')
}
```

### Hoisted Fragments

Hoisted fragments allow you to place code at strategic locations within a generated file, which is particularly useful for type declarations, constants, or utility functions that need to be available throughout the file.

### Type Definition

```typescript
export type TsHoistedFragmentPosition = 'beforeImports' | 'afterImports';

export interface TsHoistedFragment {
  key: string;
  position?: TsHoistedFragmentPosition;
  fragment: TsCodeFragment;
}
```

### Usage

Hoisted fragments are created using the `tsHoistedFragment` function and can be positioned either before or after imports:

```typescript
// Create a type definition that will be placed after imports

const typeDefinition = tsHoistedFragment(
  tsCodeFragment('interface UserData { id: string; name: string; }'),
  'user-data-interface',
  'afterImports'
);

// Create a license comment that will appear at the top of the file

const licenseComment = tsHoistedFragment(
  tsCodeFragment('// Copyright (c) 2023 Baseplate Inc.'),
  'license-header',
  'beforeImports'
);

// Include hoisted fragments in a code fragment

const codeWithHoistedFragments = tsCodeFragment(
  'function processUser(user: UserData) { return user.name; }',
  { source: '@/utils', namedImports: [{ name: 'formatName' }] },
  { hoistedFragments: [typeDefinition, licenseComment] }
);
```

When the final file is rendered, hoisted fragments are collected, deduplicated by key (keeping the highest priority version), and placed at their designated positions in the file.

### Imports and Hoisted Fragments

The system intelligently manages imports and hoisted fragments:

* **Imports**: Automatically collected, merged, and sorted at the top of the file
* **Hoisted Fragments**: Code fragments placed at specific positions (before or after imports)

## Creating and Composing Code

### Creating Code Fragments

```typescript
// Simple fragment

const codeFragment = tsCodeFragment(
  'const x = 1;',
  { source: '@/utils', namedImports: [{ name: 'formatDate' }] }
);

// With hoisted fragments

const fragmentWithHoisted = tsCodeFragment(
  'function process() { return data; }',
  { source: '@/types', namedImports: [{ name: 'DataType' }] },
  {
    hoistedFragments: [
      tsHoistedFragment(
        tsCodeFragment('interface Data { id: string; }'),
        'data-interface',
        'afterImports'
      )
    ]
  }
);
```

### Composing Code with TsCodeUtils

The `TsCodeUtils` provides utilities for composing code fragments:

```typescript
// Merge multiple fragments

const merged = TsCodeUtils.mergeFragments([fragment1, fragment2], '\n\n');

// Format a fragment with placeholders

const formatted = TsCodeUtils.formatFragment(
  'function NAME(ARG) { BODY }',
  {
    NAME: 'processData',
    ARG: 'data: DataType',
    BODY: codeFragment
  }
);

// Create objects

const options = TsCodeUtils.mergeFragmentsAsObject({
  timeout: '5000',
  formatter: formatterFragment,
  handlers: handlersFragment
});

// Template literal style composition

const result = TsCodeUtils.template`
  export function handler() {
    ${logicFragment}
    return ${resultFragment};
  }
`;
```

## Rendering Templates

Templates are rendered using the `renderTsCodeFileTemplate` function:

```typescript
const result = await renderTsCodeFileTemplate(
  template,
  {
    TPL_OPTIONS: optionsFragment,
    TPL_HANDLER: handlerFragment
  },
  {
    resolveModule: (moduleSpecifier) => resolveModule(moduleSpecifier, directory),
    importSortOptions: { internalPatterns },
    includeMetadata: false
  }
);
```

## Integration with Generators

Generators typically use the TypeScript rendering system through the `createTypescriptFileTask` helper:

```typescript
builder.addDynamicTask(
  createTypescriptFileTask({
    template: serviceFileTemplate,
    variables: {
      TPL_SERVICE_OPTIONS: optionsFragment,
      TPL_METHODS: methodsFragment,
    },
    destination: 'src/services/user-service.ts',
    fileId: 'user-service',
  })
);
```

## Module Resolution

The system handles TypeScript path aliases and module resolution:


1. TypeScript path mappings are extracted from tsconfig.json
2. When rendering, imports are resolved to their correct paths based on the file's location
3. The `resolveModule` function handles the conversion of paths like `@/utils` to proper relative paths

## Import Management

Imports are automatically:


1. Collected from all code fragments
2. Deduplicated and merged (combining named imports from the same source)
3. Sorted and grouped (internal, external, relative)
4. Inserted at the top of the file

## Best Practices


1. **Composability**: Build complex code by combining smaller fragments
2. **Type Safety**: Use TypeScript types to ensure template variables match expectations
3. **Reusability**: Create utility functions for common code patterns
4. **Hoisting**: Use hoisted fragments for type definitions needed by multiple parts of a file
5. **Templates**: Define templates in separate files for readability and maintainability

## Example: Creating a Service File

```typescript
// Define the template

const serviceFileTemplate = tsCodeFileTemplate({
  name: 'service',
  source: { path: path.join(import.meta.dirname, 'templates/service.ts') },
  variables: {
    TPL_SERVICE_NAME: {},
    TPL_METHODS: {},
    TPL_OPTIONS: {}
  }
});

// Create method fragments

const methodFragments = methods.map(method =>
  TsCodeUtils.formatFragment(
    `async METHOD_NAME(params: METHOD_PARAMS): Promise<METHOD_RETURN> {
      METHOD_BODY
    }`,
    {
      METHOD_NAME: method.name,
      METHOD_PARAMS: paramsFragment,
      METHOD_RETURN: returnFragment,
      METHOD_BODY: bodyFragment
    }
  )
);

// Render the template

await renderTsCodeFileTemplate(
  serviceFileTemplate,
  {
    TPL_SERVICE_NAME: 'UserService',
    TPL_METHODS: TsCodeUtils.mergeFragments(methodFragments, '\n\n'),
    TPL_OPTIONS: optionsFragment
  },
  { resolveModule: moduleResolver }
);
```

The TypeScript Rendering System provides a powerful and flexible way to generate TypeScript code within Baseplate generators while maintaining proper structure, imports, and formatting.
