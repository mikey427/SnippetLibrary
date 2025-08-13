# Snippet Library VS Code Extension

A developer productivity tool for managing reusable code snippets with an optional web GUI for advanced management.

## Project Structure

```
├── src/
│   ├── core/                 # Shared business logic
│   │   ├── index.ts         # Core library exports
│   │   ├── utils.ts         # Utility functions
│   │   └── validation.ts    # Validation logic
│   ├── interfaces/          # TypeScript interfaces
│   │   ├── index.ts         # Interface exports
│   │   ├── ISnippetManager.ts
│   │   └── IStorageService.ts
│   ├── types/               # Type definitions
│   │   └── index.ts         # Core types and interfaces
│   └── extension.ts         # VS Code extension entry point
├── package.json             # Extension manifest and dependencies
├── tsconfig.json           # TypeScript configuration
├── webpack.config.js       # Build configuration
└── README.md               # This file
```

## Features

- Save code snippets with metadata (title, description, tags, language)
- Quick snippet insertion via Command Palette
- Search and filter snippets
- Import/export snippet collections
- VS Code snippet system integration
- Optional web GUI for advanced management
- Configurable storage (workspace vs global)

## Development

1. Install dependencies: `npm install`
2. Compile: `npm run compile`
3. Watch mode: `npm run watch`
4. Package: `npm run package`

## Commands

- `Snippet Library: Save as Snippet` - Save selected code as a snippet
- `Snippet Library: Insert Snippet` - Insert a snippet at cursor
- `Snippet Library: Manage Snippets` - Open snippet management interface
- `Snippet Library: Open Web GUI` - Launch web-based management interface

## Configuration

- `snippetLibrary.storageLocation`: Where to store snippets (workspace/global)
- `snippetLibrary.storageFormat`: File format for storage (json/yaml)
- `snippetLibrary.autoBackup`: Enable automatic backups
