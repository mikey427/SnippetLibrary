# Developer Guide - Snippet Library

This guide provides comprehensive technical documentation for developers working on the Snippet Library project.

## 🏗️ Architecture Deep Dive

### System Architecture

The Snippet Library uses a **layered architecture** with clear separation between the VS Code extension, web GUI, and shared core logic:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├─────────────────────────┬───────────────────────────────────┤
│    VS Code Extension    │         Web GUI (React)           │
│  - Commands & Menus     │  - Visual Management Interface    │
│  - IntelliSense         │  - Advanced Search & Filtering    │
│  - Keybindings          │  - Bulk Operations                │
│  - Notifications        │  - Drag & Drop Organization       │
└─────────────────────────┴───────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│                    Core Services                            │
│  - SnippetManager      - SearchService                     │
│  - StorageService      - ImportExportService               │
│  - SynchronizationService                                  │
│  - ErrorHandler        - ValidationService                 │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                              │
├─────────────────────────────────────────────────────────────┤
│  File System Storage   │   In-Memory Cache   │   Backups   │
│  - JSON/YAML files     │   - Search indices  │   - Auto    │
│  - Configuration       │   - Recent snippets │   - Manual  │
│  - Workspace/Global    │   - User prefs      │   - Export  │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Patterns

#### 1. Repository Pattern

All data access goes through repository interfaces, allowing for easy testing and future storage backend changes:

```typescript
interface SnippetRepository {
  findAll(): Promise<Snippet[]>;
  findById(id: string): Promise<Snippet | null>;
  findByQuery(query: SearchQuery): Promise<Snippet[]>;
  save(snippet: Snippet): Promise<Snippet>;
  delete(id: string): Promise<boolean>;
}
```

#### 2. Observer Pattern

Used for real-time synchronization between VS Code extension and Web GUI:

```typescript
interface SnippetObserver {
  onSnippetCreated(snippet: Snippet): void;
  onSnippetUpdated(snippet: Snippet): void;
  onSnippetDeleted(id: string): void;
}
```

#### 3. Strategy Pattern

Different storage strategies for workspace vs global storage:

```typescript
interface StorageStrategy {
  getStoragePath(): string;
  loadSnippets(): Promise<Snippet[]>;
  saveSnippets(snippets: Snippet[]): Promise<void>;
}
```

#### 4. Command Pattern

VS Code commands are implemented using the command pattern for consistency and testability:

```typescript
interface Command {
  execute(context: CommandContext): Promise<void>;
  canExecute(context: CommandContext): boolean;
}
```

## 🔧 Core Components

### 1. Snippet Manager (`src/core/services/SnippetManager.ts`)

The central orchestrator for all snippet operations:

```typescript
export class SnippetManager {
  constructor(
    private repository: SnippetRepository,
    private validator: SnippetValidator,
    private searchService: SearchService,
    private errorHandler: ErrorHandler
  ) {}

  async createSnippet(data: SnippetData): Promise<Snippet> {
    // 1. Validate input data
    const validationResult = await this.validator.validate(data);
    if (!validationResult.isValid) {
      throw SnippetLibraryError.validation(validationResult.errors);
    }

    // 2. Create snippet with metadata
    const snippet = new Snippet({
      ...data,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    });

    // 3. Save to repository
    const savedSnippet = await this.repository.save(snippet);

    // 4. Update search index
    await this.searchService.indexSnippet(savedSnippet);

    // 5. Notify observers
    this.notifyObservers("created", savedSnippet);

    return savedSnippet;
  }
}
```

### 2. Storage Service (`src/core/services/StorageService.ts`)

Handles all file system operations with error recovery:

```typescript
export class StorageService {
  constructor(
    private config: StorageConfig,
    private fileWatcher: FileSystemWatcher,
    private errorHandler: ErrorHandler
  ) {}

  async loadSnippets(): Promise<Snippet[]> {
    return this.errorHandler.executeWithErrorHandling(
      async () => {
        const filePath = this.getSnippetsFilePath();

        // Check if file exists
        if (!(await this.fileExists(filePath))) {
          return [];
        }

        // Read and parse file
        const content = await this.readFile(filePath);
        const data = this.parseSnippetFile(content);

        // Validate and transform data
        return data.map((item) => new Snippet(item));
      },
      "loadSnippets",
      {
        maxRetries: 3,
        retryDelay: 1000,
        autoRecover: true,
      }
    );
  }
}
```

### 3. Search Service (`src/core/services/SearchService.ts`)

Advanced search with real-time indexing:

```typescript
export class SearchService {
  private searchIndex: SearchIndex;
  private queryBuilder: SearchQueryBuilder;

  async search(query: SearchQuery): Promise<SearchResult[]> {
    // 1. Build optimized query
    const optimizedQuery = this.queryBuilder.build(query);

    // 2. Execute search against index
    const results = await this.searchIndex.search(optimizedQuery);

    // 3. Apply additional filters
    const filteredResults = this.applyFilters(results, query.filters);

    // 4. Sort and paginate
    return this.sortAndPaginate(filteredResults, query.sort, query.pagination);
  }

  async indexSnippet(snippet: Snippet): Promise<void> {
    // Create searchable document
    const document = {
      id: snippet.id,
      title: snippet.title,
      description: snippet.description,
      code: snippet.code,
      language: snippet.language,
      tags: snippet.tags,
      category: snippet.category,
      // Computed fields for search
      searchText: this.createSearchText(snippet),
      keywords: this.extractKeywords(snippet.code),
      complexity: this.calculateComplexity(snippet.code),
    };

    await this.searchIndex.addDocument(document);
  }
}
```

### 4. Error Handling System

Comprehensive error management with automatic recovery:

#### Error Classification

```typescript
export enum ErrorType {
  STORAGE_ACCESS = "storage_access", // File system errors
  VALIDATION = "validation", // Data validation errors
  SYNC_CONFLICT = "sync_conflict", // Synchronization conflicts
  NETWORK = "network", // Web GUI communication
  IMPORT_EXPORT = "import_export", // Import/export operations
  SEARCH = "search", // Search service errors
  SNIPPET_OPERATION = "snippet_operation", // General snippet operations
  CONFIGURATION = "configuration", // Configuration errors
  UNKNOWN = "unknown", // Unclassified errors
}
```

#### Error Recovery Strategies

```typescript
export class ErrorRecoveryService {
  private recoveryStrategies = new Map<ErrorType, RecoveryStrategy[]>();

  constructor() {
    this.initializeRecoveryStrategies();
  }

  private initializeRecoveryStrategies(): void {
    // Storage access recovery
    this.addRecoveryStrategy({
      errorType: ErrorType.STORAGE_ACCESS,
      actions: [
        {
          id: "check_permissions",
          label: "Check File Permissions",
          automatic: false,
          action: () => this.checkFilePermissions(),
        },
        {
          id: "create_directory",
          label: "Create Storage Directory",
          automatic: true,
          action: () => this.createStorageDirectory(),
        },
        {
          id: "use_fallback_storage",
          label: "Use Fallback Storage",
          automatic: true,
          action: () => this.switchToFallbackStorage(),
        },
      ],
    });
  }
}
```

## 🧪 Testing Architecture

### Testing Strategy Overview

The project uses a **comprehensive testing pyramid**:

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← Full user workflows
                    │   (Playwright)  │
                ┌───┴─────────────────┴───┐
                │   Integration Tests     │  ← Component interaction
                │   (Vitest + Supertest)  │
            ┌───┴─────────────────────────┴───┐
            │        Unit Tests               │  ← Individual functions
            │   (Vitest + React Testing)     │
        ┌───┴─────────────────────────────────┴───┐
        │           Static Analysis               │  ← Code quality
        │      (TypeScript + ESLint)              │
    ┌───┴─────────────────────────────────────────┴───┐
```

### Unit Testing Patterns

#### Service Testing with Dependency Injection

```typescript
describe("SnippetManager", () => {
  let snippetManager: SnippetManager;
  let mockRepository: jest.Mocked<SnippetRepository>;
  let mockValidator: jest.Mocked<SnippetValidator>;
  let mockSearchService: jest.Mocked<SearchService>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockValidator = createMockValidator();
    mockSearchService = createMockSearchService();

    snippetManager = new SnippetManager(
      mockRepository,
      mockValidator,
      mockSearchService,
      new ErrorHandler()
    );
  });

  it("should create snippet with valid data", async () => {
    // Arrange
    const snippetData = createValidSnippetData();
    mockValidator.validate.mockResolvedValue({ isValid: true });
    mockRepository.save.mockResolvedValue(createSnippet(snippetData));

    // Act
    const result = await snippetManager.createSnippet(snippetData);

    // Assert
    expect(result).toBeDefined();
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: snippetData.title,
        code: snippetData.code,
      })
    );
  });
});
```

#### VS Code Extension Testing

```typescript
describe("CommandHandler", () => {
  let mockVSCode: MockVSCodeAPI;
  let commandHandler: CommandHandler;

  beforeEach(() => {
    mockVSCode = createMockVSCodeAPI();
    commandHandler = new CommandHandler(mockVSCode, mockSnippetManager);
  });

  it("should save selected text as snippet", async () => {
    // Arrange
    const selectedText = 'console.log("Hello World");';
    mockVSCode.window.activeTextEditor = {
      selection: createMockSelection(),
      document: {
        getText: jest.fn().mockReturnValue(selectedText),
        languageId: "javascript",
      },
    };

    // Act
    await commandHandler.saveSnippet();

    // Assert
    expect(mockVSCode.window.showInputBox).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Enter snippet title",
      })
    );
  });
});
```

#### React Component Testing

```typescript
describe("SnippetCard", () => {
  const mockSnippet = createMockSnippet();

  it("should display snippet information", () => {
    render(
      <SnippetCard
        snippet={mockSnippet}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(screen.getByText(mockSnippet.title)).toBeInTheDocument();
    expect(screen.getByText(mockSnippet.description)).toBeInTheDocument();
    expect(screen.getByText(mockSnippet.language)).toBeInTheDocument();
  });

  it("should call onEdit when edit button is clicked", async () => {
    const mockOnEdit = jest.fn();

    render(
      <SnippetCard
        snippet={mockSnippet}
        onEdit={mockOnEdit}
        onDelete={jest.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(mockOnEdit).toHaveBeenCalledWith(mockSnippet.id);
  });
});
```

### Integration Testing

#### API Integration Tests

```typescript
describe("Snippet API", () => {
  let app: Express;
  let server: Server;

  beforeAll(async () => {
    app = createTestApp();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server.close();
  });

  it("should create and retrieve snippet", async () => {
    const snippetData = createValidSnippetData();

    // Create snippet
    const createResponse = await request(app)
      .post("/api/snippets")
      .send(snippetData)
      .expect(201);

    const createdSnippet = createResponse.body;

    // Retrieve snippet
    const getResponse = await request(app)
      .get(`/api/snippets/${createdSnippet.id}`)
      .expect(200);

    expect(getResponse.body).toMatchObject({
      id: createdSnippet.id,
      title: snippetData.title,
      code: snippetData.code,
    });
  });
});
```

### Performance Testing

#### Load Testing for Large Collections

```typescript
describe("Performance Tests", () => {
  it("should handle 10,000 snippets efficiently", async () => {
    // Arrange
    const snippets = Array.from({ length: 10000 }, (_, i) =>
      createMockSnippet({ title: `Snippet ${i}` })
    );

    await snippetManager.bulkImport(snippets);

    // Act & Assert
    const startTime = performance.now();
    const results = await snippetManager.searchSnippets({
      text: "function",
      limit: 50,
    });
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    expect(results.length).toBeGreaterThan(0);
  });

  it("should maintain memory usage under 100MB", async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Perform memory-intensive operations
    await performBulkOperations();

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

    expect(memoryIncrease).toBeLessThan(100);
  });
});
```

## 🚀 Development Workflow

### Local Development Setup

1. **Environment Setup**:

   ```bash
   # Install dependencies
   npm install

   # Set up development environment
   npm run setup:dev

   # Start development servers
   npm run dev
   ```

2. **Development Servers**:

   ```bash
   # Terminal 1: Extension development
   npm run watch:extension

   # Terminal 2: Web GUI client
   npm run dev:client

   # Terminal 3: Web GUI server
   npm run dev:server

   # Terminal 4: Tests in watch mode
   npm run test:watch
   ```

### Code Quality Tools

#### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

#### ESLint Rules

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Git Workflow

#### Branch Naming Convention

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

#### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:

```
feat(search): add fuzzy search with highlighting

- Implement fuzzy search algorithm for snippet titles
- Add search result highlighting in Web GUI
- Improve search performance for large collections

Closes #123
```

### Release Process

1. **Version Bump**:

   ```bash
   npm version patch|minor|major
   ```

2. **Build and Test**:

   ```bash
   npm run build
   npm run test:all
   npm run lint
   ```

3. **Package Extension**:

   ```bash
   npm run package
   ```

4. **Create Release**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

## 🔍 Debugging Guide

### VS Code Extension Debugging

#### Debug Configuration (`.vscode/launch.json`)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "${workspaceFolder}:npm: compile"
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
      ],
      "outFiles": ["${workspaceFolder}/out/test/**/*.js"],
      "preLaunchTask": "${workspaceFolder}:npm: compile-tests"
    }
  ]
}
```

#### Debugging Tips

- Use `console.log()` for quick debugging (output appears in Debug Console)
- Set breakpoints in TypeScript files (source maps enabled)
- Use VS Code's built-in debugger for step-through debugging
- Check the Extension Host output panel for errors

### Web GUI Debugging

#### Client-Side Debugging

```typescript
// Enable debug mode
localStorage.setItem("debug", "snippet-library:*");

// Debug specific modules
localStorage.setItem("debug", "snippet-library:search,snippet-library:api");

// Use debug utility
import debug from "debug";
const log = debug("snippet-library:component");

log("Component rendered with props:", props);
```

#### Server-Side Debugging

```typescript
// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("API Error:", error);
  res.status(500).json({ error: error.message });
});
```

### Common Issues and Solutions

#### Extension Not Loading

```bash
# Check extension logs
code --log debug --extensionDevelopmentPath .

# Clear extension cache
rm -rf ~/.vscode/extensions/snippet-library*

# Rebuild extension
npm run clean && npm run compile
```

#### Web GUI Connection Issues

```bash
# Check server status
curl http://localhost:3000/api/health

# Check port availability
netstat -an | grep 3000

# Restart server with different port
PORT=3001 npm run dev:server
```

#### Storage Issues

```bash
# Check file permissions
ls -la ~/.vscode/extensions/snippet-library/

# Verify storage location
code --list-extensions --show-versions

# Reset storage
rm -rf ~/.vscode/extensions/snippet-library/storage/
```

## 📊 Performance Optimization

### Memory Management

#### Efficient Data Structures

```typescript
// Use Maps for O(1) lookups
class SnippetCache {
  private cache = new Map<string, Snippet>();
  private accessTimes = new Map<string, number>();

  get(id: string): Snippet | undefined {
    const snippet = this.cache.get(id);
    if (snippet) {
      this.accessTimes.set(id, Date.now());
    }
    return snippet;
  }

  // LRU eviction
  private evictLeastRecentlyUsed(): void {
    if (this.cache.size <= this.maxSize) return;

    let oldestTime = Date.now();
    let oldestId = "";

    for (const [id, time] of this.accessTimes) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }

    this.cache.delete(oldestId);
    this.accessTimes.delete(oldestId);
  }
}
```

#### Memory Leak Prevention

```typescript
class ComponentWithCleanup {
  private subscriptions: Subscription[] = [];
  private timers: NodeJS.Timeout[] = [];

  constructor() {
    // Track subscriptions
    this.subscriptions.push(
      eventEmitter.on("event", this.handleEvent.bind(this))
    );

    // Track timers
    this.timers.push(setInterval(this.periodicTask.bind(this), 1000));
  }

  dispose(): void {
    // Clean up subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];

    // Clear timers
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];
  }
}
```

### Search Performance

#### Indexing Strategy

```typescript
class SearchIndex {
  private titleIndex = new Map<string, Set<string>>();
  private contentIndex = new Map<string, Set<string>>();
  private tagIndex = new Map<string, Set<string>>();

  indexSnippet(snippet: Snippet): void {
    // Index title words
    const titleWords = this.tokenize(snippet.title);
    titleWords.forEach((word) => {
      if (!this.titleIndex.has(word)) {
        this.titleIndex.set(word, new Set());
      }
      this.titleIndex.get(word)!.add(snippet.id);
    });

    // Index content with stemming
    const contentWords = this.tokenizeAndStem(snippet.code);
    contentWords.forEach((word) => {
      if (!this.contentIndex.has(word)) {
        this.contentIndex.set(word, new Set());
      }
      this.contentIndex.get(word)!.add(snippet.id);
    });

    // Index tags
    snippet.tags.forEach((tag) => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(snippet.id);
    });
  }
}
```

#### Query Optimization

```typescript
class QueryOptimizer {
  optimizeQuery(query: SearchQuery): OptimizedQuery {
    // Use most selective filter first
    const filters = this.sortFiltersBySelectivity(query.filters);

    // Combine filters efficiently
    const combinedFilter = this.combineFilters(filters);

    // Optimize sort operations
    const optimizedSort = this.optimizeSort(query.sort);

    return {
      filters: combinedFilter,
      sort: optimizedSort,
      limit: query.limit || 50,
    };
  }

  private sortFiltersBySelectivity(filters: Filter[]): Filter[] {
    return filters.sort((a, b) => {
      // Language filters are most selective
      if (a.type === "language") return -1;
      if (b.type === "language") return 1;

      // Tag filters are moderately selective
      if (a.type === "tag") return -1;
      if (b.type === "tag") return 1;

      // Text filters are least selective
      return 0;
    });
  }
}
```

## 🔐 Security Considerations

### Input Validation

#### Snippet Data Validation

```typescript
class SnippetValidator {
  private readonly MAX_TITLE_LENGTH = 200;
  private readonly MAX_DESCRIPTION_LENGTH = 1000;
  private readonly MAX_CODE_LENGTH = 50000;
  private readonly ALLOWED_LANGUAGES = new Set([
    "javascript",
    "typescript",
    "python",
    "java",
    "csharp",
    "cpp",
    "c",
    "go",
    "rust",
    "php",
    "ruby",
    "swift",
  ]);

  validate(data: SnippetData): ValidationResult {
    const errors: string[] = [];

    // Title validation
    if (!data.title || data.title.trim().length === 0) {
      errors.push("Title is required");
    } else if (data.title.length > this.MAX_TITLE_LENGTH) {
      errors.push(
        `Title must be less than ${this.MAX_TITLE_LENGTH} characters`
      );
    }

    // Code validation
    if (!data.code || data.code.trim().length === 0) {
      errors.push("Code is required");
    } else if (data.code.length > this.MAX_CODE_LENGTH) {
      errors.push(`Code must be less than ${this.MAX_CODE_LENGTH} characters`);
    }

    // Language validation
    if (data.language && !this.ALLOWED_LANGUAGES.has(data.language)) {
      errors.push("Invalid programming language");
    }

    // Sanitize HTML in description
    if (data.description) {
      data.description = this.sanitizeHtml(data.description);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: data,
    };
  }

  private sanitizeHtml(input: string): string {
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }
}
```

### File System Security

#### Path Traversal Prevention

```typescript
class SecureFileService {
  private readonly ALLOWED_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);
  private readonly BASE_PATH: string;

  constructor(basePath: string) {
    this.BASE_PATH = path.resolve(basePath);
  }

  async readFile(relativePath: string): Promise<string> {
    const fullPath = this.validatePath(relativePath);

    // Check file extension
    const ext = path.extname(fullPath);
    if (!this.ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error("File type not allowed");
    }

    return fs.readFile(fullPath, "utf-8");
  }

  private validatePath(relativePath: string): string {
    // Resolve the full path
    const fullPath = path.resolve(this.BASE_PATH, relativePath);

    // Ensure the path is within the base directory
    if (!fullPath.startsWith(this.BASE_PATH)) {
      throw new Error("Path traversal attempt detected");
    }

    return fullPath;
  }
}
```

### Web GUI Security

#### CORS Configuration

```typescript
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests from VS Code extension
    if (!origin || origin.startsWith("vscode-webview://")) {
      callback(null, true);
    } else if (origin === "http://localhost:3000") {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
```

#### Request Rate Limiting

```typescript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", rateLimiter);
```

## 🚀 Future Development Roadmap

### Phase 1: Core Enhancements (Q1 2024)

- **Cloud Synchronization**: Sync snippets across devices
- **Team Collaboration**: Share snippet collections
- **Advanced Search**: Natural language queries
- **Performance**: Support for 50,000+ snippets

### Phase 2: AI Integration (Q2 2024)

- **Smart Suggestions**: AI-powered snippet recommendations
- **Code Generation**: Generate snippets from descriptions
- **Auto-tagging**: Automatic tag generation
- **Duplicate Detection**: Find and merge similar snippets

### Phase 3: Ecosystem Expansion (Q3 2024)

- **IDE Plugins**: Support for IntelliJ, Sublime Text
- **Mobile App**: Companion mobile application
- **Web Platform**: Standalone web application
- **API**: Public API for third-party integrations

### Phase 4: Enterprise Features (Q4 2024)

- **SSO Integration**: Enterprise authentication
- **Audit Logging**: Track snippet usage and changes
- **Compliance**: GDPR, SOC2 compliance
- **Analytics**: Usage analytics and insights

### Technical Debt Priorities

1. **Test Coverage**: Increase to 95%+ coverage
2. **Performance**: Optimize for large collections
3. **Accessibility**: WCAG 2.1 AA compliance
4. **Documentation**: Comprehensive API docs
5. **Internationalization**: Multi-language support

### Architecture Evolution

#### Microservices Migration

```
Current Monolith → Target Microservices

┌─────────────────┐    ┌─────────────────┐
│   VS Code Ext   │    │   VS Code Ext   │
├─────────────────┤    ├─────────────────┤
│   Web GUI       │ →  │   Web GUI       │
├─────────────────┤    ├─────────────────┤
│   Core Services │    │   API Gateway   │
├─────────────────┤    ├─────────────────┤
│   File Storage  │    │ ┌─────┬─────┬───┐│
└─────────────────┘    │ │Auth │Search│...││
                       │ └─────┴─────┴───┘│
                       └─────────────────┘
```

#### Event-Driven Architecture

```typescript
interface SnippetEvent {
  type: "created" | "updated" | "deleted" | "searched";
  payload: any;
  timestamp: Date;
  userId: string;
}

class EventBus {
  async publish(event: SnippetEvent): Promise<void> {
    // Publish to message queue (Redis, RabbitMQ, etc.)
  }

  subscribe(eventType: string, handler: EventHandler): void {
    // Subscribe to specific event types
  }
}
```

This developer guide provides the technical foundation needed to understand, maintain, and extend the Snippet Library project. Regular updates to this documentation ensure it remains current with the evolving codebase.
