# outline-sync

A tool for syncing documentation from [Outline](https://www.getoutline.com/) to your local filesystem, enabling seamless integration with static site generators and AI assistants.

## Features

- 📥 **Download documentation** from Outline to your local filesystem
- 📤 **Upload changes** back to Outline
- 🎯 **Selective sync** with collection filtering
- 📁 **Organized structure** with nested folders matching your Outline hierarchy
- 🖼️ **Image support** - automatically download and upload embedded images
- 🤖 **AI-friendly** format for LLMs like Claude to read and interact with docs
- ⚡ **Static site ready** - works perfectly with Astro Starlight and other generators
- 🔄 **Bidirectional sync** - download from and upload to Outline
- 🔍 **Semantic search** - find documents using AI-powered similarity search

## Installation

```bash
npm install outline-sync
# or
pnpm add outline-sync
# or
yarn add outline-sync
```

## Configuration

Set your Outline API token as an environment variable:

```bash
# .env file or environment
OUTLINE_API_TOKEN=your-api-token-here
```

Create an `outline-sync.config.js` file in your project root:

```javascript
export default {
  // Optional: Outline API configuration
  outline: {
    // API URL (defaults to 'https://app.getoutline.com/api')
    apiUrl: 'https://your-team.getoutline.com/api',
  },

  // Required: Collections to sync
  collections: [
    {
      // The URL ID of the collection (from the collection's URL)
      urlId: 'engineering-docs-h3kj5',
      // Optional: Custom directory name (defaults to collection name)
      directory: 'engineering',
    },
    {
      urlId: 'api-reference-k2j8d',
    },
  ],

  // Optional: Output directory (defaults to 'docs')
  outputDir: './docs',

  // Optional: Behavior configuration
  behavior: {
    // Skip writing metadata files (defaults to false)
    skipMetadata: false,
    // Clean up removed documents after download (defaults to true)
    cleanupAfterDownload: true,
    // Download and upload embedded images (defaults to true)
    includeImages: true,
  },

  // Optional: Language model configuration for AI features
  languageModel: {
    // Provider: 'anthropic', 'google', or 'openai'
    provider: 'anthropic',
    // Optional: Model name (defaults vary by provider)
    model: 'claude-3-5-sonnet-20241022',
  },
};
```

## Usage

### Command Line

```bash
# Download all documents from Outline
npx outline-sync download

# Upload local changes back to Outline
npx outline-sync upload

# Annotate documents with AI-generated titles/descriptions
npx outline-sync annotate

# Search across your Outline collections
npx outline-sync search "your search query"

# Use a custom config file
npx outline-sync download --config ./custom-config.js
```

### Programmatic Usage

```javascript
import { download, upload } from 'outline-sync';

// Download documents (uses config file and OUTLINE_API_TOKEN env var)
await download({
  // Optional: Override output directory
  dir: './custom-docs',
});

// Upload changes
await upload({
  // Optional: Override source directory
  source: './custom-docs',
  // Optional: Target a specific collection
  collection: 'engineering-docs-h3kj5',
  // Optional: Only update existing documents
  updateOnly: true,
});
```

## Integration with Static Site Generators

### Astro Starlight

Add outline-sync to your build process:

```json
{
  "scripts": {
    "docs:sync": "outline-sync download",
    "build": "npm run docs:sync && astro build"
  }
}
```

Configure Starlight to read from the synced directory:

```javascript
// astro.config.mjs
export default defineConfig({
  integrations: [
    starlight({
      sidebar: [
        {
          label: 'Documentation',
          autogenerate: { directory: 'docs' },
        },
      ],
    }),
  ],
});
```

## AI Assistant Integration

The synced documentation structure is optimized for AI assistants like Claude to read and understand your documentation:

1. **Hierarchical structure** - Collections become folders, maintaining your organization
2. **Markdown format** - Clean, readable markdown files
3. **Metadata preservation** - Document metadata is preserved in frontmatter
4. **Bidirectional updates** - AI can suggest changes that can be uploaded back to Outline

Example workflow with Claude:

```
1. Sync docs: `npx outline-sync download`
2. Claude reads from `./docs` directory
3. Claude suggests documentation improvements
4. Upload changes: `npx outline-sync upload`
```

## File Structure

After syncing, your documentation will be organized as:

```
docs/
├── collection-name/
│   ├── document-title.md
│   ├── document-title/
│   │   ├── 4fba1872-7f67-42ac-9d4b-5712197d0253.png
│   │   └── another-uuid.jpg
│   ├── nested-collection/
│   │   └── another-document.md
│   └── _metadata.json
└── another-collection/
    └── document.md
```

Each markdown file includes:

- Frontmatter with document metadata (id, title, description)
- The document content in clean markdown
- Preserved formatting and structure

## Image Support

When `includeImages` is enabled (default), outline-sync automatically handles embedded images:

### Download

- Detects all images embedded in Outline documents
- Downloads images to a folder named after the document
- Converts Outline attachment URLs to relative paths in markdown
- Preserves image captions and alt text

### Upload

- Detects relative image paths in your local markdown files
- Automatically uploads new images to Outline
- Restores existing Outline attachment URLs (based on UUID filenames)
- Handles image uploads for both new and existing documents

### Example

Outline document with image:

```markdown
![Architecture Diagram](/api/attachments.redirect?id=4fba1872-7f67-42ac-9d4b-5712197d0253)
```

Downloaded as:

```markdown
![Architecture Diagram](./images/4fba1872-7f67-42ac-9d4b-5712197d0253.png)
```

The image file is saved to:

```
docs/collection-name/images/4fba1872-7f67-42ac-9d4b-5712197d0253.png
```

## AI Features

### Annotate Command

The `annotate` command uses AI to automatically generate titles and descriptions for your markdown documents that are missing this metadata. This is particularly useful after downloading documents from Outline that may not have complete frontmatter.

```bash
# Annotate all documents in all collections
npx outline-sync annotate
```

#### Language Model Support

The annotate command supports multiple language model providers. You'll need to:

1. **Install the provider's package** (optional peer dependencies):

   ```bash
   # For Anthropic Claude
   npm install @langchain/anthropic

   # For Google Gemini
   npm install @langchain/google-genai

   # For OpenAI GPT
   npm install @langchain/openai
   ```

2. **Configure the provider** in your config file:

   ```javascript
   export default {
     // ... other config
     languageModel: {
       provider: 'anthropic', // or 'google' or 'openai'
       model: 'claude-3-5-sonnet-20241022', // optional, defaults vary by provider
     },
   };
   ```

3. **Set the appropriate API key** as an environment variable (see Environment Variables section)

The command will:

- Scan all markdown files in your configured collections
- Skip files that already have both title and description
- Use AI to generate appropriate titles and descriptions based on content
- Update the frontmatter while preserving all other metadata

### Search Command

The `search` command enables semantic search across your Outline collections using vector embeddings:

```bash
# Search with default settings (5 results, no content)
npx outline-sync search "API authentication methods"

# Search with custom limit
npx outline-sync search "database optimization" --limit 10

# Include document contents in results
npx outline-sync search "error handling" --include-contents

# Search specific collections
npx outline-sync search "deployment process" --collections engineering-docs-h3kj5,devops-k2j8d
```

Features:

- **Semantic search** - Finds documents based on meaning, not just keywords
- **Fast indexing** - Creates vector embeddings for all documents
- **Flexible results** - Control result count and whether to include full content
- **Collection filtering** - Search across all collections or specific ones

Requirements:

- Requires language model configuration in your config file
- Automatically creates and manages search indexes using FAISS

## Environment Variables

The tool requires the following environment variables:

```bash
# .env
# Required: Your Outline API token
OUTLINE_API_TOKEN=your-api-token-here

# Optional: API keys for language model providers (needed for annotate command)
ANTHROPIC_API_KEY=your-anthropic-key-here  # For Anthropic Claude
GOOGLE_API_KEY=your-google-key-here        # For Google Gemini
OPENAI_API_KEY=your-openai-key-here        # For OpenAI GPT
```

API tokens are automatically loaded from the environment. You can use a `.env` file in your project root for local development.

## API Token

To get your Outline API token:

1. Log in to your Outline instance
2. Go to Settings → API Tokens
3. Create a new token with read/write permissions
4. Copy the token and store it securely

## Requirements

- Node.js 20+
- An Outline instance with API access
- API token with appropriate permissions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/your-username/outline-sync/issues).
