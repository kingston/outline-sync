import type { GrayMatterFile } from 'gray-matter';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { globby } from 'globby';
import matter from 'gray-matter';
import fsAdapter from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';
import { z } from 'zod';

import type { DocumentCollectionWithConfig } from '@src/utils/collection-filter.js';

import { getLanguageChatModel } from '@src/services/langchain.js';
import { getOutlineService } from '@src/services/outline.js';
import { getCollectionConfigs } from '@src/utils/collection-filter.js';

import type {
  AnnotateOptions,
  Config,
  LanguageModelConfig,
} from '../types/config.js';

const titleDescriptionSchema = z.object({
  title: z
    .string()
    .max(100)
    .describe('A short title for the document under 100 characters'),
  description: z
    .string()
    .max(200)
    .describe('A short description for the document under 200 characters'),
});

export async function getTitleDescription(
  filePath: string,
  frontmatter: GrayMatterFile<string>,
  languageModelConfig: LanguageModelConfig,
): Promise<{ title: string; description: string }> {
  const { content } = frontmatter;

  const filename = filePath.endsWith('index.md')
    ? path.basename(path.basename(filePath))
    : path.basename(filePath);
  const model = await getLanguageChatModel(languageModelConfig);

  const structuredModel = model.withStructuredOutput(titleDescriptionSchema);

  const result = await structuredModel.invoke([
    new SystemMessage(
      `You are a helpful assistant that generates a title and description for a document.
      If there is no content and the filename is index.md, you can make the description just mention it indexes the contents of the directory.`,
    ),
    new HumanMessage(`The filename is ${filename}.`),
    new HumanMessage(content),
  ]);

  return result;
}

export async function annotateFile(
  filePath: string,
  frontmatter: GrayMatterFile<string>,
  languageModelConfig: LanguageModelConfig,
): Promise<{ result: 'skipped' | 'updated' }> {
  const { data, content } = frontmatter;
  const existingTitle = data.title as string | undefined;
  const existingDescription = data.description as string | undefined;
  if (existingTitle && existingDescription) {
    return { result: 'skipped' };
  }

  const { title, description } = await getTitleDescription(
    filePath,
    frontmatter,
    languageModelConfig,
  );

  await fs.writeFile(
    filePath,
    matter.stringify(content, {
      ...data,
      title: existingTitle ?? title,
      description: existingDescription ?? description,
    }),
  );

  return { result: 'updated' };
}

async function annotateCollectionFiles(
  collection: DocumentCollectionWithConfig,
  languageModelConfig: LanguageModelConfig,
): Promise<{ updated: number; skipped: number }> {
  const spinner = ora({
    hideCursor: false,
    text: `Annotating collection: ${collection.name}`,
  }).start();

  try {
    // Get all markdown files in the collection
    const markdownFiles = await globby('**/*.md', {
      cwd: collection.outputDirectory,
      fs: fsAdapter,
    });

    spinner.text = `Found ${markdownFiles.length.toString()} markdown files in ${collection.name}`;

    let updated = 0;
    let skipped = 0;

    // Annotate each markdown file if missing metadata
    for (const [index, file] of markdownFiles.entries()) {
      spinner.text = `Processing ${collection.name} (${String(index + 1)}/${String(markdownFiles.length)}): ${file}`;

      const filePath = path.join(collection.outputDirectory, file);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const parsed = matter(fileContent);
      const { result } = await annotateFile(
        filePath,
        parsed,
        languageModelConfig,
      );

      if (result === 'updated') {
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    spinner.succeed(
      `Annotated ${collection.name}: ${String(updated)} updated, ${String(skipped)} skipped`,
    );

    return { updated, skipped };
  } catch (error) {
    spinner.fail(`Failed to annotate collection: ${collection.name}`);
    throw error;
  }
}
/**
 * Annotates markdown files with a title/description if it is missing from the metadata
 */
export async function annotateCommand(
  config: Config,
  options: AnnotateOptions,
): Promise<void> {
  if (!config.languageModel) {
    throw new Error('Language model configuration is required');
  }

  const service = getOutlineService(config.outline.apiUrl);
  const outlineCollections = await service.getCollections();
  const collections = getCollectionConfigs(outlineCollections, config, {
    collectionUrlIdsFilter: options.collections,
    outputDir: options.dir,
  });

  for (const collection of collections) {
    await annotateCollectionFiles(collection, config.languageModel);
  }
}
