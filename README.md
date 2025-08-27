# Snippet Library

A comprehensive developer productivity tool that provides reusable code snippets and components through a VS Code extension with an optional web GUI for advanced management.

## 🚀 Quick Start

### Prerequisites

- **VS Code**: Version 1.74.0 or higher
- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher

### Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd snippet-library
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build the extension**:

   ```bash
   npm run compile
   ```

4. **Install in VS Code**:
   - Press `F5` to open a new Extension Development Host window
   - Or package the extension: `npm run package` and install the `.vsix` file

### First Use

1. **Save your first snippet**:

   - Select some code in VS Code
   - Press `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac)
   - Fill in the snippet details and save

2. **Insert a snippet**:

   - Press `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac)
   - Search and select your snippet
   - The code will be inserted at your cursor

3. **Open the Web GUI** (optional):
   - Open Command Palette (`Ctrl+Shift+P`)
   - Run "Snippet Library: Open Web GUI"
   - Manage your snippets visually in the browser

## 📖 User Guide

### Core Features

#### 1. Saving Snippets

**From VS Code**:

- Select code → `Ctrl+Shift+S` → Fill details → Save
- Or use Command Palette: "Snippet Library: Save as Snippet"

**From Web GUI**:

- Click "New Snippet" → Enter code and metadata → Save

**Snippet Metadata**:

- **Title**: Descriptive name for the snippet
- **Description**: Detailed explanation of what the code does
- **Language**: Programming language (auto-detected from file)
- **Tags**: Keywords for organization and search
- **Category**: Optional grouping (e.g., "React Components", "Utilities")
- **Prefix**: Trigger text for IntelliSense (optional)

#### 2. Using Snippets

**Quick Insert**:

- `Ctrl+Shift+I` → Search → Select → Insert

**IntelliSense Integration**:

- Type snippet prefix → Select from autocomplete
- Works with VS Code's native snippet system

**Command Palette**:

- "Snippet Library: Insert Snippet" → Browse all snippets

#### 3. Managing Snippets

**VS Code Commands**:

- `snippetLibrary.manageSnippets`: Open management interface
- `snippetLibrary.openWebGUI`: Launch web interface

**Web GUI Features**:

- Visual grid/list view of all snippets
- Advanced search and filtering
- Bulk operations (tag, delete, categorize)
- Drag-and-drop organization
- Syntax-highlighted code previews

#### 4. Search and Filtering

**Search Criteria**:

- **Text**: Search in title, description, and code content
- **Language**: Filter by programming language
- **Tags**: Filter by one or more tags
- **Category**: Filter by category
- **Date Range**: Filter by creation/modification date

**Search Operators**:

- `tag:react` - Find snippets with "react" tag
- `lang:typescript` - Find TypeScript snippets
- `category:utils` - Find utility snippets
- `"exact phrase"` - Search for exact text matches

#### 5. Import/Export

**Export Formats**:

- **JSON**: Complete snippet data with metadata
- **VS Code Snippets**: Compatible with VS Code's snippet format
- **Selective Export**: Export by tags, categories, or date ranges

**Import Sources**:

- JSON files from previous exports
- VS Code snippet files
- Other snippet library formats

**Import Options**:

- **Merge**: Add to existing snippets
- **Replace**: Overwrite existing snippets
- **Skip Duplicates**: Ignore snippets that already exist

### Configuration

Access settings via VS Code Settings (`Ctrl+,`) → Search "Snippet Library":

#### Storage Settings

- **Storage Location**:

  - `global`: Snippets available across all workspaces
  - `workspace`: Snippets specific to current workspace

- **Storage Format**:

  - `json`: Human-readable JSON format
  - `yaml`: YAML format for better readability

- **Auto Backup**:
  - Automatically create backups of snippet data
  - Configurable backup interval

#### Web GUI Settings

- **Auto-launch**: Start web GUI when VS Code opens
- **Port**: Custom port for web server (default: 3000)
- **Auto-shutdown**: Close web GUI when VS Code closes

### Keyboard Shortcuts

| Action          | Windows/Linux  | Mac           | Customizable |
| --------------- | -------------- | ------------- | ------------ |
| Save Snippet    | `Ctrl+Shift+S` | `Cmd+Shift+S` | ✅           |
| Insert Snippet  | `Ctrl+Shift+I` | `Cmd+Shift+I` | ✅           |
| Open Web GUI    | -              | -             | ✅           |
| Manage Snippets | -              | -             | ✅           |

**Customize shortcuts**:

1. Open Keyboard Shortcuts (`Ctrl+K Ctrl+S`)
2. Search "Snippet Library"
3. Click pencil icon to edit

## 🛠️ Developer Guide

### Project Structure

```
snippet-library/
├── src/
│   ├── core/                 # Shared business logic
│   │   ├── errors/          # Error handling system
│   │   ├── models/          # Data models and types
│   │   ├── services/        # Core services (storage, search, etc.)
│   │   └── index.ts         # Core exports
│   ├── extension/           # VS Code extension
│   │   ├── __tests__/       # Extension tests
│   │   ├── errors/          # VS Code-specific error handling
│   │   ├── CommandHandler.ts
│   │   ├── ConfigurationManager.ts
│   │   ├── SnippetLibraryExtension.ts
│   │   ├── VSCodeSnippetIntegration.ts
│   │   └── WebGUILauncher.ts
│   ├── webgui/              # Web interface
│   │   ├── client/          # React frontend
│   │   │   ├── components/  # React components
│   │   │   ├── pages/       # Page components
│   │   │   ├── store/       # Redux store
│   │   │   └── utils/       # Client utilities
│   │   ├── server/          # Express backend
│   │   └── types/           # Web GUI types
│   ├── interfaces/          # TypeScript interfaces
│   ├── types/               # Shared type definitions
│   └── extension.ts         # Extension entry point
├── .kiro/                   # Project specifications
│   └── specs/snippet-library/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
└── package.json
```

### Architecture Overview

The Snippet Library follows a **modular architecture** with clear separation of concerns:

#### Core Layer (`src/core/`)

- **Business Logic**: Snippet management, validation, search
- **Services**: Storage, synchronization, import/export
- **Error Handling**: Comprehensive error management system
- **Models**: Data structures and validation

#### Extension Layer (`src/extension/`)

- **VS Code Integration**: Commands, keybindings, IntelliSense
- **Configuration Management**: Settings and preferences
- **Web GUI Launcher**: Local server management

#### Web GUI Layer (`src/webgui/`)

- **Client**: React application with Redux state management
- **Server**: Express.js API server
- **Real-time Sync**: WebSocket communication

### Key Components

#### 1. Snippet Manager (`src/core/services/SnippetManager.ts`)

Central service for all snippet operations:

```typescript
interface SnippetManager {
  createSnippet(snippet: SnippetData): Promise<Snippet>;
  getSnippet(id: string): Promise<Snippet | null>;
  updateSnippet(id: string, updates: Partial<SnippetData>): Promise<Snippet>;
  deleteSnippet(id: string): Promise<boolean>;
  searchSnippets(query: SearchQuery): Promise<Snippet[]>;
  importSnippets(data: ImportData): Promise<ImportResult>;
  exportSnippets(filter?: ExportFilter): Promise<ExportData>;
}
```

#### 2. Storage Service (`src/core/services/StorageService.ts`)

Handles persistence with support for multiple storage locations:

```typescript
interface StorageService {
  loadSnippets(): Promise<Snippet[]>;
  saveSnippets(snippets: Snippet[]): Promise<void>;
  watchChanges(callback: (changes: StorageChange[]) => void): void;
  getStorageLocation(): StorageLocation;
  setStorageLocation(location: StorageLocation): Promise<void>;
}
```

#### 3. Error Handling System (`src/core/errors/`)

Comprehensive error management with recovery strategies:

- **SnippetLibraryError**: Custom error class with context
- **ErrorLogger**: Centralized logging with multiple outputs
- **RetryManager**: Automatic retry for transient failures
- **ErrorRecoveryService**: Recovery actions and suggestions
- **ErrorHandler**: Central coordinator for all error handling

#### 4. Search Service (`src/core/services/SearchService.ts`)

Advanced search capabilities:

- **Real-time Search**: Instant results as you type
- **Query Builder**: Complex search queries with multiple criteria
- **Performance Optimization**: Efficient indexing and caching

### Development Workflow

#### Setting Up Development Environment

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Start development servers**:

   ```bash
   # Terminal 1: Watch mode for extension
   npm run watch

   # Terminal 2: Web GUI development server
   cd src/webgui/client
   npm run dev

   # Terminal 3: API server
   cd src/webgui/server
   npm run dev
   ```

3. **Run tests**:

   ```bash
   # All tests
   npm test

   # Unit tests only
   npm run test:unit

   # Watch mode
   npm run test:watch
   ```

#### Code Style and Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for TypeScript and React
- **Prettier**: Code formatting (run `npm run format`)
- **Testing**: Vitest for unit tests, React Testing Library for components

#### Adding New Features

1. **Update Requirements**: Document new requirements in `.kiro/specs/snippet-library/requirements.md`
2. **Design**: Update design document with architectural changes
3. **Implement**: Follow the existing patterns and structure
4. **Test**: Add comprehensive tests for new functionality
5. **Document**: Update this README and add inline documentation

### Testing Strategy

#### Unit Tests

- **Core Services**: Business logic testing with mocked dependencies
- **Extension**: VS Code API mocking for isolated testing
- **Web GUI**: Component testing with React Testing Library

#### Integration Tests

- **Cross-Interface**: Synchronization between VS Code and Web GUI
- **Storage**: File system operations and data persistence
- **API**: End-to-end API testing with supertest

#### Performance Tests

- **Large Collections**: Testing with 1000+ snippets
- **Search Performance**: Complex queries and filtering
- **Memory Usage**: Long-running session testing

### Error Handling

The system includes a comprehensive error handling framework:

#### Error Types

- **Storage Errors**: File access, corruption, permissions
- **Validation Errors**: Invalid snippet data, malformed imports
- **Sync Errors**: Conflicts between interfaces
- **Network Errors**: Web GUI communication issues

#### Recovery Strategies

- **Automatic Retry**: For transient failures
- **User Guidance**: Clear error messages with suggested actions
- **Graceful Degradation**: Continue operation when possible
- **Data Recovery**: Backup and restore capabilities

### Performance Considerations

#### Optimization Strategies

- **Lazy Loading**: Load snippets on demand
- **Caching**: In-memory caching for frequently accessed data
- **Indexing**: Efficient search indexing for large collections
- **Virtualization**: Virtual scrolling for large lists in Web GUI

#### Memory Management

- **Cleanup**: Proper disposal of resources and event listeners
- **Weak References**: Avoid memory leaks in long-running processes
- **Batch Operations**: Efficient bulk operations for large datasets

## 🔧 Advanced Configuration

### Custom Storage Locations

You can configure custom storage paths:

```json
{
  "snippetLibrary.storageLocation": "workspace",
  "snippetLibrary.customPath": "./my-snippets/"
}
```

### Web GUI Customization

The Web GUI can be customized through configuration:

```json
{
  "snippetLibrary.webGUI": {
    "port": 3000,
    "autoLaunch": false,
    "theme": "dark",
    "defaultView": "grid"
  }
}
```

### Backup and Recovery

Automatic backups are created in:

- **Global**: `~/.vscode/extensions/snippet-library/backups/`
- **Workspace**: `.vscode/snippets/backups/`

Manual backup:

1. Command Palette → "Snippet Library: Export All Snippets"
2. Choose location and format
3. Save backup file

Restore from backup:

1. Command Palette → "Snippet Library: Import Snippets"
2. Select backup file
3. Choose import options

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Loading

- Check VS Code version (requires 1.74.0+)
- Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
- Check extension logs: Output panel → "Snippet Library"

#### Snippets Not Saving

- Check file permissions in storage directory
- Verify storage location setting
- Check available disk space

#### Web GUI Not Opening

- Check if port 3000 is available
- Try different port in settings
- Check firewall settings

#### Search Not Working

- Rebuild search index: Command Palette → "Snippet Library: Rebuild Index"
- Check snippet file integrity
- Clear cache and reload

### Debug Mode

Enable debug logging:

```json
{
  "snippetLibrary.debug": true,
  "snippetLibrary.logLevel": "debug"
}
```

View logs:

- VS Code: Output panel → "Snippet Library"
- Web GUI: Browser Developer Tools → Console

### Getting Help

1. **Check Documentation**: This README and inline help
2. **Search Issues**: Check existing GitHub issues
3. **Create Issue**: Provide logs, steps to reproduce, and environment details
4. **Community**: Join discussions and share tips

## 🤝 Contributing

### For New Contributors

1. **Read the Code**: Start with `src/core/` to understand the business logic
2. **Run Tests**: Ensure all tests pass before making changes
3. **Small Changes First**: Start with bug fixes or small improvements
4. **Follow Patterns**: Maintain consistency with existing code style

### Development Guidelines

#### Code Quality

- **Type Safety**: Use TypeScript strictly, avoid `any`
- **Error Handling**: Always handle errors gracefully
- **Testing**: Write tests for new functionality
- **Documentation**: Update docs for user-facing changes

#### Architecture Principles

- **Separation of Concerns**: Keep layers independent
- **Single Responsibility**: Each class/function has one purpose
- **Dependency Injection**: Use interfaces for testability
- **Immutability**: Prefer immutable data structures

#### Performance Guidelines

- **Async Operations**: Use async/await for I/O operations
- **Memory Efficiency**: Clean up resources and event listeners
- **Caching**: Cache expensive operations appropriately
- **Lazy Loading**: Load data only when needed

### Future Development Areas

#### High Priority

1. **Cloud Synchronization**: Sync snippets across devices
2. **Team Sharing**: Share snippet collections with team members
3. **AI Integration**: AI-powered snippet suggestions and generation
4. **Plugin System**: Allow third-party extensions

#### Medium Priority

1. **Advanced Search**: Natural language search queries
2. **Snippet Analytics**: Usage statistics and recommendations
3. **Version Control**: Track snippet changes over time
4. **Mobile App**: Companion mobile app for snippet access

#### Low Priority

1. **IDE Integration**: Support for other IDEs (IntelliJ, Sublime)
2. **Snippet Marketplace**: Public repository of snippets
3. **Advanced Templating**: Dynamic snippet generation
4. **Integration APIs**: REST API for external tool integration

### Technical Debt Areas

1. **Test Coverage**: Increase test coverage to 90%+
2. **Performance**: Optimize for collections with 10,000+ snippets
3. **Accessibility**: Improve Web GUI accessibility compliance
4. **Documentation**: Add comprehensive API documentation
5. **Internationalization**: Support for multiple languages

### Architecture Improvements

1. **Microservices**: Split Web GUI into separate services
2. **Event Sourcing**: Implement event-driven architecture
3. **CQRS**: Separate read/write operations for better performance
4. **GraphQL**: Replace REST API with GraphQL for better flexibility

