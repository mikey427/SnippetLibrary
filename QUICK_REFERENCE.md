# Quick Reference Guide - Snippet Library

## 🚀 Quick Start Commands

```bash
# Setup
npm install                    # Install dependencies
npm run compile               # Build extension
npm run dev                   # Start all development servers

# Development
npm run watch                 # Watch mode for extension
npm run dev:client           # Start React dev server
npm run dev:server           # Start API server
npm run test:watch           # Run tests in watch mode

# Testing
npm test                     # Run all tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e           # End-to-end tests

# Build & Package
npm run build              # Production build
npm run package           # Create .vsix package
npm run lint              # Run linter
npm run format            # Format code
```

## 📁 Key File Locations

```
src/
├── core/                           # Shared business logic
│   ├── services/SnippetManager.ts  # Main snippet operations
│   ├── services/StorageService.ts  # File system operations
│   ├── services/SearchService.ts   # Search functionality
│   └── errors/                     # Error handling system
├── extension/                      # VS Code extension
│   ├── SnippetLibraryExtension.ts  # Main extension class
│   ├── CommandHandler.ts           # VS Code commands
│   └── VSCodeSnippetIntegration.ts # IntelliSense integration
└── webgui/                        # Web interface
    ├── client/                    # React frontend
    │   ├── pages/SnippetGrid/     # Main snippet view
    │   ├── components/Search/     # Search components
    │   └── store/                 # Redux store
    └── server/                    # Express backend
        └── WebGUIServer.ts        # API server
```

## 🔧 Common Development Tasks

### Adding a New VS Code Command

1. **Register command in `package.json`**:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "snippetLibrary.myNewCommand",
        "title": "My New Command",
        "category": "Snippet Library"
      }
    ]
  }
}
```

2. **Implement in `CommandHandler.ts`**:

```typescript
export class CommandHandler {
  async myNewCommand(): Promise<void> {
    try {
      // Command implementation
      const result = await this.snippetManager.doSomething();
      vscode.window.showInformationMessage("Command executed successfully");
    } catch (error) {
      this.errorHandler.handleCommandError("myNewCommand", error);
    }
  }
}
```

3. **Register in `SnippetLibraryExtension.ts`**:

```typescript
export function activate(context: vscode.ExtensionContext) {
  const commandHandler = new CommandHandler(snippetManager);

  context.subscriptions.push(
    vscode.commands.registerCommand("snippetLibrary.myNewCommand", () =>
      commandHandler.myNewCommand()
    )
  );
}
```

### Adding a New API Endpoint

1. **Add route in `WebGUIServer.ts`**:

```typescript
private setupRoutes(): void {
  this.app.get('/api/my-endpoint', async (req, res) => {
    try {
      const result = await this.snippetManager.doSomething();
      res.json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  });
}
```

2. **Add client method in `api.ts`**:

```typescript
export class ApiClient {
  async myEndpoint(): Promise<MyResult> {
    const response = await fetch("/api/my-endpoint");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
}
```

3. **Use in React component**:

```typescript
const MyComponent: React.FC = () => {
  const [data, setData] = useState<MyResult | null>(null);

  useEffect(() => {
    apiClient
      .myEndpoint()
      .then(setData)
      .catch((error) => console.error("Failed to fetch data:", error));
  }, []);

  return <div>{data ? JSON.stringify(data) : "Loading..."}</div>;
};
```

### Adding a New React Component

1. **Create component file**:

```typescript
// src/webgui/client/components/MyComponent/MyComponent.tsx
import React from "react";
import "./MyComponent.css";

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({
  title,
  onAction,
}) => {
  return (
    <div className="my-component">
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
};
```

2. **Add styles**:

```css
/* src/webgui/client/components/MyComponent/MyComponent.css */
.my-component {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.my-component h2 {
  margin: 0 0 1rem 0;
  color: #333;
}
```

3. **Add tests**:

```typescript
// src/webgui/client/components/MyComponent/__tests__/MyComponent.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MyComponent } from "../MyComponent";

describe("MyComponent", () => {
  it("should render title", () => {
    render(<MyComponent title="Test Title" onAction={() => {}} />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("should call onAction when button is clicked", () => {
    const mockOnAction = jest.fn();
    render(<MyComponent title="Test" onAction={mockOnAction} />);

    fireEvent.click(screen.getByRole("button", { name: /action/i }));
    expect(mockOnAction).toHaveBeenCalled();
  });
});
```

### Adding Error Handling

1. **Create custom error**:

```typescript
const customError = SnippetLibraryError.validation("Invalid snippet data", {
  field: "title",
  value: "",
});
```

2. **Handle with recovery**:

```typescript
try {
  await riskyOperation();
} catch (error) {
  const result = await errorHandler.handleError(error, {
    component: "MyService",
    operation: "riskyOperation",
  });

  if (!result.success) {
    // Show user-friendly message
    vscode.window.showErrorMessage(
      errorHandler.getUserFriendlyMessage(result.error!)
    );
  }
}
```

3. **Add recovery strategy**:

```typescript
errorRecoveryService.addRecoveryStrategy({
  errorType: ErrorType.CUSTOM,
  autoExecute: true,
  priority: 1,
  actions: [
    {
      id: "fix_custom_error",
      label: "Fix Custom Error",
      description: "Automatically fix the custom error",
      action: async () => {
        // Recovery logic
      },
      automatic: true,
    },
  ],
});
```

## 🧪 Testing Patterns

### Unit Test Template

```typescript
describe("ServiceName", () => {
  let service: ServiceName;
  let mockDependency: jest.Mocked<DependencyType>;

  beforeEach(() => {
    mockDependency = createMockDependency();
    service = new ServiceName(mockDependency);
  });

  describe("methodName", () => {
    it("should handle success case", async () => {
      // Arrange
      const input = createValidInput();
      mockDependency.method.mockResolvedValue(expectedOutput);

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toEqual(expectedOutput);
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });

    it("should handle error case", async () => {
      // Arrange
      const input = createInvalidInput();
      mockDependency.method.mockRejectedValue(new Error("Test error"));

      // Act & Assert
      await expect(service.methodName(input)).rejects.toThrow("Test error");
    });
  });
});
```

### React Component Test Template

```typescript
describe("ComponentName", () => {
  const defaultProps = {
    prop1: "value1",
    prop2: jest.fn(),
  };

  it("should render correctly", () => {
    render(<ComponentName {...defaultProps} />);

    expect(screen.getByText("Expected Text")).toBeInTheDocument();
  });

  it("should handle user interaction", async () => {
    const user = userEvent.setup();
    render(<ComponentName {...defaultProps} />);

    await user.click(screen.getByRole("button"));

    expect(defaultProps.prop2).toHaveBeenCalled();
  });
});
```

### Integration Test Template

```typescript
describe("Feature Integration", () => {
  let testApp: TestApplication;

  beforeAll(async () => {
    testApp = await createTestApplication();
  });

  afterAll(async () => {
    await testApp.cleanup();
  });

  it("should complete end-to-end workflow", async () => {
    // Arrange
    const testData = createTestData();

    // Act
    const result = await testApp.executeWorkflow(testData);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject(expectedResult);
  });
});
```

## 🔍 Debugging Cheat Sheet

### VS Code Extension Debugging

```typescript
// Add to any extension file for debugging
console.log("Debug info:", data); // Shows in Debug Console
vscode.window.showInformationMessage("Debug: " + JSON.stringify(data));

// Check extension logs
// View → Output → Select "Snippet Library" from dropdown
```

### Web GUI Debugging

```typescript
// Client-side debugging
console.log("Client debug:", data); // Browser console
localStorage.setItem("debug", "snippet-library:*"); // Enable debug logs

// Server-side debugging
console.log("Server debug:", data); // Terminal output
process.env.DEBUG = "snippet-library:*"; // Enable debug logs
```

### Common Debug Commands

```bash
# Check extension status
code --list-extensions --show-versions | grep snippet

# View extension logs
code --log debug

# Check web server
curl http://localhost:3000/api/health

# Check file permissions
ls -la ~/.vscode/extensions/snippet-library/

# Clear caches
rm -rf node_modules/.cache
rm -rf ~/.vscode/extensions/snippet-library/cache/
```

## 📊 Performance Monitoring

### Memory Usage

```typescript
// Check memory usage
const memUsage = process.memoryUsage();
console.log("Memory usage:", {
  rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
  heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
  heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
});
```

### Performance Timing

```typescript
// Measure operation performance
const startTime = performance.now();
await expensiveOperation();
const endTime = performance.now();
console.log(`Operation took ${endTime - startTime} milliseconds`);
```

### Search Performance

```typescript
// Monitor search performance
const searchMetrics = {
  queryTime: 0,
  resultCount: 0,
  indexSize: 0,
};

const startTime = performance.now();
const results = await searchService.search(query);
searchMetrics.queryTime = performance.now() - startTime;
searchMetrics.resultCount = results.length;
```

## 🚨 Common Issues & Solutions

### Extension Won't Load

```bash
# Solution 1: Rebuild extension
npm run clean && npm run compile

# Solution 2: Check VS Code version
code --version  # Should be 1.74.0+

# Solution 3: Clear extension cache
rm -rf ~/.vscode/extensions/snippet-library*
```

### Web GUI Won't Start

```bash
# Solution 1: Check port availability
lsof -i :3000  # Check if port is in use

# Solution 2: Use different port
PORT=3001 npm run dev:server

# Solution 3: Clear node modules
rm -rf node_modules && npm install
```

### Tests Failing

```bash
# Solution 1: Update snapshots
npm test -- --updateSnapshot

# Solution 2: Clear test cache
npm test -- --clearCache

# Solution 3: Run tests individually
npm test -- --testNamePattern="specific test"
```

### Build Errors

```bash
# Solution 1: Clean build
npm run clean && npm run build

# Solution 2: Check TypeScript errors
npx tsc --noEmit

# Solution 3: Update dependencies
npm update
```

## 📚 Useful Resources

### Documentation Links

- [VS Code Extension API](https://code.visualstudio.com/api)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)

### Internal Documentation

- `README.md` - User guide and setup
- `DEVELOPER_GUIDE.md` - Detailed technical documentation
- `.kiro/specs/` - Project specifications and requirements
- `src/*/README.md` - Component-specific documentation

### Code Examples

- `src/core/services/__tests__/` - Service testing examples
- `src/webgui/client/components/__tests__/` - React testing examples
- `src/extension/__tests__/` - VS Code extension testing examples

This quick reference provides immediate access to the most common development tasks and solutions for the Snippet Library project.
