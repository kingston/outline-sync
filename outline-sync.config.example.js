// Example configuration file for outline-sync
// Copy this to outline-sync.config.js and customize as needed

export default {
  // Outline API Configuration
  outline: {
    apiUrl: process.env.OUTLINE_API_URL || 'https://app.getoutline.com/api',
    apiToken: process.env.OUTLINE_API_TOKEN // Required: Set in .env file
  },

  // Collections to sync (empty array = all collections)
  collections: [
    // 'collection-id-1',
    // 'collection-id-2'
    // Or use collection names:
    // 'Engineering Docs',
    // 'Product Specs'
  ],

  // Local directory settings
  directories: {
    download: './docs',          // Where to download files
    upload: './docs'             // Where to upload files from
  },

  // Download/Upload behavior
  behavior: {
    preserveMetadata: true,      // Enable/disable frontmatter metadata
    includeArchived: false       // Don't include archived documents
  }
};