import { EventEmitter } from "events";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server } from "http";
import {
  SnippetInterface,
  StorageChange,
  Result,
  ErrorType,
} from "../../types";
import { SyncEvent } from "./SynchronizationService";

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type:
    | "snippet_update"
    | "bulk_update"
    | "sync_request"
    | "conflict_resolution"
    | "heartbeat";
  data: any;
  timestamp: Date;
  clientId?: string;
}

/**
 * WebSocket client information
 */
export interface WebSocketClient {
  id: string;
  socket: Socket;
  connectedAt: Date;
  lastActivity: Date;
  userAgent?: string;
}

/**
 * WebSocket synchronization configuration
 */
export interface WebSocketSyncConfig {
  port?: number;
  path?: string;
  heartbeatInterval: number;
  clientTimeout: number;
  maxClients: number;
}

/**
 * Interface for WebSocket synchronization service
 */
export interface WebSocketSyncService {
  /**
   * Initialize WebSocket server
   */
  initialize(
    server: Server,
    config: WebSocketSyncConfig
  ): Promise<Result<void>>;

  /**
   * Start WebSocket service
   */
  start(): Promise<Result<void>>;

  /**
   * Stop WebSocket service
   */
  stop(): Promise<Result<void>>;

  /**
   * Broadcast snippet update to all clients
   */
  broadcastSnippetUpdate(
    snippet: SnippetInterface,
    action: "created" | "updated" | "deleted"
  ): void;

  /**
   * Broadcast bulk update to all clients
   */
  broadcastBulkUpdate(action: string, count: number): void;

  /**
   * Broadcast sync event to all clients
   */
  broadcastSyncEvent(event: SyncEvent): void;

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): boolean;

  /**
   * Get connected clients
   */
  getConnectedClients(): WebSocketClient[];

  /**
   * Register message handler
   */
  onMessage(
    callback: (message: WebSocketMessage, clientId: string) => void
  ): void;

  /**
   * Remove message handler
   */
  offMessage(
    callback: (message: WebSocketMessage, clientId: string) => void
  ): void;

  /**
   * Register client connection handler
   */
  onClientConnect(callback: (client: WebSocketClient) => void): void;

  /**
   * Register client disconnection handler
   */
  onClientDisconnect(callback: (clientId: string) => void): void;

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    connectedClients: number;
    totalMessages: number;
    uptime: number;
  };

  /**
   * Dispose resources
   */
  dispose(): void;
}

/**
 * Implementation of WebSocket synchronization service
 */
export class WebSocketSyncServiceImpl
  extends EventEmitter
  implements WebSocketSyncService
{
  private io: SocketIOServer | null = null;
  private config: WebSocketSyncConfig;
  private clients = new Map<string, WebSocketClient>();
  private isRunning = false;
  private startTime: Date | null = null;
  private messageCount = 0;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      clientTimeout: 60000, // 1 minute
      maxClients: 100,
    };
  }

  async initialize(
    server: Server,
    config: WebSocketSyncConfig
  ): Promise<Result<void>> {
    try {
      this.config = { ...this.config, ...config };

      this.io = new SocketIOServer(server, {
        path: this.config.path || "/socket.io",
        cors: {
          origin: "*", // Configure appropriately for production
          methods: ["GET", "POST"],
        },
        pingTimeout: this.config.clientTimeout,
        pingInterval: this.config.heartbeatInterval,
      });

      this.setupEventHandlers();

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.network,
          message: `Failed to initialize WebSocket service: ${error}`,
          recoverable: true,
          suggestedAction: "Check server configuration and try again",
        },
      };
    }
  }

  async start(): Promise<Result<void>> {
    try {
      if (this.isRunning) {
        return {
          success: false,
          error: {
            type: ErrorType.unknown,
            message: "WebSocket service is already running",
            recoverable: true,
          },
        };
      }

      if (!this.io) {
        return {
          success: false,
          error: {
            type: ErrorType.unknown,
            message: "WebSocket service not initialized",
            recoverable: true,
            suggestedAction: "Call initialize() first",
          },
        };
      }

      this.isRunning = true;
      this.startTime = new Date();
      this.setupHeartbeat();

      console.log("WebSocket synchronization service started");

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.network,
          message: `Failed to start WebSocket service: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  async stop(): Promise<Result<void>> {
    try {
      this.isRunning = false;

      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = undefined;
      }

      if (this.io) {
        // Disconnect all clients
        this.io.disconnectSockets(true);
        this.io.close();
        this.io = null;
      }

      this.clients.clear();
      console.log("WebSocket synchronization service stopped");

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.network,
          message: `Failed to stop WebSocket service: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  broadcastSnippetUpdate(
    snippet: SnippetInterface,
    action: "created" | "updated" | "deleted"
  ): void {
    if (!this.io || !this.isRunning) return;

    const message: WebSocketMessage = {
      type: "snippet_update",
      data: {
        action,
        snippet,
      },
      timestamp: new Date(),
    };

    this.io.emit("snippetUpdate", message);
    this.messageCount++;
  }

  broadcastBulkUpdate(action: string, count: number): void {
    if (!this.io || !this.isRunning) return;

    const message: WebSocketMessage = {
      type: "bulk_update",
      data: {
        action,
        count,
      },
      timestamp: new Date(),
    };

    this.io.emit("bulkUpdate", message);
    this.messageCount++;
  }

  broadcastSyncEvent(event: SyncEvent): void {
    if (!this.io || !this.isRunning) return;

    const message: WebSocketMessage = {
      type: "sync_request",
      data: event,
      timestamp: new Date(),
    };

    this.io.emit("syncEvent", message);
    this.messageCount++;
  }

  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || !this.isRunning) return false;

    try {
      client.socket.emit("message", message);
      client.lastActivity = new Date();
      this.messageCount++;
      return true;
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      return false;
    }
  }

  getConnectedClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  onMessage(
    callback: (message: WebSocketMessage, clientId: string) => void
  ): void {
    this.on("message", callback);
  }

  offMessage(
    callback: (message: WebSocketMessage, clientId: string) => void
  ): void {
    this.off("message", callback);
  }

  onClientConnect(callback: (client: WebSocketClient) => void): void {
    this.on("clientConnect", callback);
  }

  onClientDisconnect(callback: (clientId: string) => void): void {
    this.on("clientDisconnect", callback);
  }

  getStatus() {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;

    return {
      isRunning: this.isRunning,
      connectedClients: this.clients.size,
      totalMessages: this.messageCount,
      uptime,
    };
  }

  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on("connection", (socket: Socket) => {
      this.handleClientConnection(socket);
    });
  }

  private handleClientConnection(socket: Socket): void {
    // Check client limit
    if (this.clients.size >= this.config.maxClients) {
      console.warn("Maximum client limit reached, rejecting connection");
      socket.disconnect(true);
      return;
    }

    const client: WebSocketClient = {
      id: socket.id,
      socket,
      connectedAt: new Date(),
      lastActivity: new Date(),
      userAgent: socket.handshake.headers["user-agent"],
    };

    this.clients.set(socket.id, client);

    console.log(
      `WebSocket client connected: ${socket.id} (${this.clients.size} total)`
    );

    // Send welcome message
    try {
      socket.emit("connected", {
        message: "Connected to snippet library synchronization service",
        timestamp: new Date().toISOString(),
        clientId: socket.id,
      });
    } catch (error) {
      console.error(
        `Failed to send welcome message to client ${socket.id}:`,
        error
      );
      socket.disconnect(true);
      this.clients.delete(socket.id);
      return;
    }

    // Set up client event handlers
    this.setupClientEventHandlers(socket, client);

    // Emit client connect event
    this.emit("clientConnect", client);
  }

  private setupClientEventHandlers(
    socket: Socket,
    client: WebSocketClient
  ): void {
    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(
        `WebSocket client disconnected: ${socket.id} (reason: ${reason})`
      );
      this.clients.delete(socket.id);
      this.emit("clientDisconnect", socket.id);
    });

    // Handle messages from client
    socket.on("message", (data) => {
      try {
        const message: WebSocketMessage = {
          ...data,
          clientId: socket.id,
          timestamp: new Date(),
        };

        client.lastActivity = new Date();
        this.emit("message", message, socket.id);
      } catch (error) {
        console.error("Error handling client message:", error);
      }
    });

    // Handle sync requests
    socket.on("syncRequest", (data) => {
      const message: WebSocketMessage = {
        type: "sync_request",
        data,
        timestamp: new Date(),
        clientId: socket.id,
      };

      client.lastActivity = new Date();
      this.emit("message", message, socket.id);
    });

    // Handle conflict resolution
    socket.on("conflictResolution", (data) => {
      const message: WebSocketMessage = {
        type: "conflict_resolution",
        data,
        timestamp: new Date(),
        clientId: socket.id,
      };

      client.lastActivity = new Date();
      this.emit("message", message, socket.id);
    });

    // Handle heartbeat/ping
    socket.on("ping", () => {
      client.lastActivity = new Date();
      socket.emit("pong", { timestamp: new Date().toISOString() });
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error(`WebSocket client error (${socket.id}):`, error);
    });
  }

  private setupHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      const timeoutThreshold = now.getTime() - this.config.clientTimeout;

      // Check for inactive clients
      for (const [clientId, client] of this.clients) {
        if (client.lastActivity.getTime() < timeoutThreshold) {
          console.log(`Disconnecting inactive client: ${clientId}`);
          client.socket.disconnect(true);
          this.clients.delete(clientId);
        }
      }

      // Send heartbeat to active clients
      if (this.io) {
        this.io.emit("heartbeat", {
          timestamp: now.toISOString(),
          connectedClients: this.clients.size,
        });
      }
    }, this.config.heartbeatInterval);
  }
}
