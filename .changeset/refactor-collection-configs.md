---
'outline-sync': minor
---

Refactor getCollectionConfigs API and CLI commands

- Updated `getCollectionConfigs` to use a more logical API with an `overrides` parameter object instead of positional arguments
- Changed all CLI commands to use consistent named options:
  - `-c, --collections <ids...>` for filtering collections by URL IDs
  - `-d, --dir <directory>` for overriding the output/source directory
- Removed all deprecated command options for a cleaner API
- Added proper TypeScript interfaces for command options: `DownloadOptions`, `UploadOptions`, `McpOptions`, and `AnnotateOptions`
