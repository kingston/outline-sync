import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import path from 'node:path';
import { z } from 'zod';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { readDocumentFile } from '@src/services/output-files.js';
import { fileExists, writeDocumentFile } from '@src/utils/file-manager.js';
import { createSafeFilename } from '@src/utils/file-names.js';

import { DOCUMENT_URI_REGEX, parseDocumentUri } from '../utils/document-uri.js';

export interface FindReplaceCommand {
  oldText: string;
  newText: string;
  numReplacements?: number;
}

export interface InlineEditParams {
  documentUri: string;
  commands: FindReplaceCommand[];
}

export interface InlineEditResult {
  documentUri: string;
  counts: number[];
}

/**
 * Edit a local document file by applying find-replace commands
 * @throws Error if collection not found, read-only, or document not found
 */
export async function mcpInlineEdit(
  params: InlineEditParams,
  collections: DocumentCollectionWithConfig[],
): Promise<InlineEditResult> {
  const { collectionKey, documentPath } = parseDocumentUri(params.documentUri);

  // Find the collection
  const collection = collections.find(
    (c) => createSafeFilename(c.name) === collectionKey,
  );
  if (!collection) {
    throw new Error(`Collection with key '${collectionKey}' not found`);
  }

  // Check if collection is read-only
  if (collection.mcp.readOnly) {
    throw new Error(`Collection '${collection.name}' is read-only`);
  }

  // Construct the full file path
  const fullPath = path.join(collection.outputDirectory, documentPath);

  // Check if file exists
  if (!(await fileExists(fullPath))) {
    throw new Error(`Document not found at path '${documentPath}'`);
  }

  // Read the current document
  const document = await readDocumentFile(fullPath, collection);
  let { content } = document;

  // Apply each find-replace command
  const counts = params.commands.map((cmd) => {
    const regex = new RegExp(escapeRegExp(cmd.oldText), 'g');
    const matches = content.match(regex) ?? [];
    const count = matches.length;
    const expectedCount = cmd.numReplacements ?? 1;

    if (count !== expectedCount) {
      throw new Error(
        `Expected ${String(expectedCount)} replacements for '${cmd.oldText}', but found ${String(count)}`,
      );
    }

    content = content.replace(regex, cmd.newText);
    return count;
  });

  // Write the updated document
  await writeDocumentFile(fullPath, content, document.metadata);

  return {
    documentUri: params.documentUri,
    counts,
  };
}

export function setupInlineEditTool(
  server: McpServer,
  collections: DocumentCollectionWithConfig[],
): void {
  server.tool(
    'inline-edit',
    'Edit a local document file by applying find-replace commands',
    {
      documentUri: z
        .string()
        .describe('The URI of the document to edit')
        .regex(
          DOCUMENT_URI_REGEX,
          'Invalid document URI. Should be in the format documents://{collectionKey}/{documentPath}',
        ),
      commands: z
        .array(
          z.object({
            oldText: z.string().describe('The text to find'),
            newText: z.string().describe('The text to replace with'),
            numReplacements: z
              .number()
              .optional()
              .describe('Expected number of replacements (defaults to 1)'),
          }),
        )
        .describe('Array of find-replace commands to apply'),
    },
    async (editParams) => {
      const result = await mcpInlineEdit(editParams, collections);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}

// Helper to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
