# WebGUI Launcher

The WebGUI Launcher is responsible for managing the web GUI server lifecycle and browser integration within VS Code.

## Features

### Server Lifecycle Management

- **Start Server**: Automatically starts the web GUI server with progress notifications
- **Stop Server**: Gracefully stops the server with cleanup
- **Restart Server**: Combines stop and start operations
- **Health Monitoring**: Continuous health checks with automatic recovery options

### Browser Integration

- **Launch in Browser**: Opens the web GUI in the default browser using VS Code's `env.openExternal`
- **URL Management**: Generates correct local server URLs
- **Clipboard Integration**: Copy server URL to clipboard

### VS Code Integration

- **Command Registration**: Integrates with VS Code command palette
- **Progress Notifications**: Shows progress during server operations
- **Error Handling**: User-friendly error messages and recovery suggestions
- **Lifecycle Management**: Handles VS Code window events and graceful shutdown

### Configuration Management

- **Dynamic Updates**: Update server configuration without restart
- **Auto-start**: Optional automatic server startup on extension activation
- **Auto-shutdown**: Optional automatic server shutdown on VS Code exit

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VS Code       │    │  WebGUILauncher  │    │ WebGUIServer    │
│   Commands      │───▶│                  │───▶│   Manager       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              ▼                          ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Health Monitor  │    │  Express Server │
                       └──────────────────┘    └─────────────────┘
                              │                          │
                              ▼                          ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Browser Launch  │    │   WebSocket     │
                       └──────────────────┘    └─────────────────┘
```

## Usage

### Basic Usage

```typescript
import { WebGUILauncher } from "./WebGUILauncher";

const config = {
  port: 3000,
  host: "localhost",
  autoStart: false,
  autoShutdown: true,
  openInBrowser: true,
  healthCheckInterval: 30000,
  maxStartupRetries: 3,
};

const launcher = new WebGUILauncher(config, {
  snippetManager,
  syncCoordinator,
});

// Initialize
await launcher.initialize();

// Launch web GUI
await launcher.launchWebGUI();
```

### VS Code Commands

The launcher registers the following VS Code commands:

- `snippetLibrary.launchWebGUI` - Launch web GUI (start server + open browser)
- `snippetLibrary.startWebGUIServer` - Start server only
- `snippetLibrary.stopWebGUIServer` - Stop server
- `snippetLibrary.restartWebGUIServer` - Restart server
- `snippetLibrary.webGUIStatus` - Show server status

### Configuration Options

```typescript
interface WebGUILauncherConfig {
  port: number; // Server port (default: 3000)
  host: string; // Server host (default: 'localhost')
  autoStart: boolean; // Auto-start on initialization
  autoShutdown: boolean; // Auto-shutdown on VS Code exit
  openInBrowser: boolean; // Open browser when launching
  healthCheckInterval: number; // Health check interval in ms
  maxStartupRetries: number; // Max startup retry attempts
}
```

## Health Monitoring

The launcher includes a health monitoring system that:

1. **Periodic Checks**: Performs HTTP health checks at configured intervals
2. **Failure Detection**: Detects when the server becomes unhealthy
3. **User Notifications**: Shows warnings when health checks fail
4. **Recovery Options**: Provides restart/stop options to users

### Health Check Process

```typescript
// Health check implementation
private async performHealthCheck(): Promise<boolean> {
  try {
    const response = await http.request(`${serverUrl}/health`);
    return response.statusCode === 200;
  } catch (error) {
    return false;
  }
}
```

## Error Handling

The launcher implements comprehensive error handling:

### Server Startup Errors

- Port conflicts
- Permission issues
- Network errors
- Configuration errors

### Runtime Errors

- Health check failures
- Browser launch failures
- Configuration update errors

### Recovery Strategies

- Automatic retries with exponential backoff
- User-guided recovery options
- Graceful degradation

## Browser Integration

### Launch Process

1. Verify server is running
2. Generate correct server URL
3. Use VS Code's `env.openExternal` API
4. Handle launch failures gracefully

### URL Generation

```typescript
getServerUrl(): string {
  return `http://${this.config.host}:${this.config.port}`;
}
```

## VS Code Lifecycle Integration

### Window Events

- Monitors VS Code window focus changes
- Handles graceful shutdown on exit
- Respects user configuration for auto-shutdown

### Extension Lifecycle

- Initializes with extension activation
- Disposes resources on extension deactivation
- Handles configuration changes dynamically

## Testing

The launcher includes comprehensive tests covering:

### Unit Tests

- Configuration management
- Server status tracking
- Error handling scenarios
- Disposal cleanup

### Integration Tests

- Full server lifecycle
- Browser integration
- Health monitoring
- Configuration updates

### Manual Testing

Due to VS Code API dependencies, some functionality requires manual testing:

1. Browser launching
2. VS Code command integration
3. Progress notifications
4. Window lifecycle events

## Requirements Fulfilled

This implementation fulfills the following requirements:

### Requirement 15.1

✅ **Command Palette Integration**: Provides `snippetLibrary.launchWebGUI` command

### Requirement 15.2

✅ **Browser Launch**: Opens web GUI in default browser with correct URL

### Requirement 15.3

✅ **Auto Server Start**: Automatically starts server when not running

### Requirement 15.4

✅ **Graceful Shutdown**: Optionally shuts down server on VS Code exit

## Future Enhancements

Potential improvements for future versions:

1. **Multi-instance Support**: Handle multiple VS Code windows
2. **Custom Browser Selection**: Allow users to choose specific browsers
3. **SSL/HTTPS Support**: Enable secure connections
4. **Performance Monitoring**: Track server performance metrics
5. **Advanced Health Checks**: More sophisticated health monitoring
6. **Backup Server Ports**: Automatic port fallback on conflicts

## Dependencies

- **WebGUIServerManager**: Manages the underlying Express server
- **VS Code API**: Window management, commands, notifications
- **Node.js HTTP**: Health check implementation
- **SnippetManager**: Core snippet functionality
- **SynchronizationCoordinator**: Real-time sync capabilities
