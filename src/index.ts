#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import dotenv from 'dotenv';

import type {
  AnnotateOptions,
  DownloadOptions,
  McpOptions,
  SearchOptions,
  UploadOptions,
} from './types/config.js';

import { annotateCommand } from './commands/annotate.js';
import { downloadCommand } from './commands/download.js';
import { mcpCommand } from './commands/mcp.js';
import { ragSearchCommand } from './commands/rag-search.js';
import { searchCommand } from './commands/search.js';
import { uploadCommand } from './commands/upload.js';
import { loadConfig } from './utils/config.js';

dotenv.config();

const program = new Command();

interface GlobalOptions {
  config?: string;
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
}

program
  .name('outline-sync')
  .description('Sync Outline collections with local file systems')
  .version('0.1.0');

// Global options
program
  .option('-c, --config <path>', 'Custom config file path')
  .option('-v, --verbose', 'Verbose output')
  .option('-q, --quiet', 'Minimal output')
  .option('--dry-run', 'Show what would be done without executing');

// Download command
program
  .command('download')
  .description('Download collections from Outline to local directory')
  .option('-d, --dir <directory>', 'Output directory')
  .option('-c, --collections <ids...>', 'Collection URL IDs to download')
  .action(async (options: DownloadOptions) => {
    const config = await loadConfig(program.opts<GlobalOptions>().config);

    await downloadCommand(config, options);
  });

// Upload command
program
  .command('upload')
  .description('Upload local markdown files to Outline')
  .option('-d, --dir <directory>', 'Source directory')
  .option('-c, --collections <ids...>', 'Collection URL IDs to upload')
  .option('--create-missing', 'Create collections/documents if missing')
  .option('--update-only', 'Only update existing documents')
  .action(async (options: UploadOptions) => {
    try {
      const config = await loadConfig(program.opts<GlobalOptions>().config);

      await uploadCommand(config, options);
    } catch (error) {
      console.error(
        chalk.red('Error:'),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

// MCP server command
program
  .command('mcp')
  .description('Start MCP server for AI assistant integration')
  .option('-d, --dir <directory>', 'Output directory')
  .option('-c, --collections <ids...>', 'Collection URL IDs to expose via MCP')
  .option(
    '--transport <transport>',
    'MCP server transport (stdio or streamable-http)',
  )
  .option('--port <port>', 'MCP server port')
  .action(async (options: McpOptions) => {
    const config = await loadConfig(program.opts<GlobalOptions>().config);

    await mcpCommand(config, options);
  });

// Annotate command
program
  .command('annotate')
  .description('Annotate markdown files with title and description')
  .option('-d, --dir <directory>', 'Output directory')
  .option('-c, --collections <ids...>', 'Collection URL IDs to annotate')
  .action(async (options: AnnotateOptions) => {
    const config = await loadConfig(program.opts<GlobalOptions>().config);

    await annotateCommand(config, options);
  });

// Search command
program
  .command('search <query>')
  .description('Search through document collections using vector similarity')
  .option('-d, --dir <directory>', 'Output directory')
  .option('-c, --collections <ids...>', 'Collection URL IDs to search')
  .option('--include-contents', 'Include document contents in results')
  .option('--limit <number>', 'Maximum number of results to return', '5')
  .action(async (query: string, options: SearchOptions) => {
    const config = await loadConfig(program.opts<GlobalOptions>().config);

    await searchCommand(config, {
      ...options,
      limit: options.limit,
      query,
    });
  });

// RAG Search command
program
  .command('rag-search <query>')
  .description('Search through document chunks using RAG similarity')
  .option('-d, --dir <directory>', 'Output directory')
  .option('-c, --collections <ids...>', 'Collection URL IDs to search')
  .option('--limit <number>', 'Maximum number of results to return', '10')
  .action(async (query: string, options: SearchOptions) => {
    const config = await loadConfig(program.opts<GlobalOptions>().config);

    await ragSearchCommand(config, {
      ...options,
      limit: options.limit,
      query,
    });
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Invalid command:'), program.args.join(' '));
  console.info('See --help for a list of available commands.');
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (process.argv.slice(2).length === 0) {
  program.outputHelp();
}
