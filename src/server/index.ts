import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

import { config } from "./providers/config.js";
import { createRedisClient } from "./providers/redis/index.js";
import { usageProvider } from "./providers/usage/index.js";
import type { AsyncStateManager } from "./managers/types.js";
import { MultiRoomStateManager } from "./managers/MultiRoomStateManager.js";
import { RedisStateManager } from "./managers/RedisStateManager.js";
import { MultiRoomClientManager } from "./managers/MultiRoomClientManager.js";
import { YjsDocManager } from "./managers/YjsDocManager.js";
import type { RoomRegistry } from "./registries/types.js";
import { InMemoryRoomRegistry } from "./registries/InMemoryRoomRegistry.js";
import { RedisRoomRegistry } from "./registries/RedisRoomRegistry.js";
import { registerAuthRoutes } from "./routes/index.js";
import { createElementRoutes } from "./routes/elementRoutes.js";
import { createProblemRoutes } from "./routes/problemRoutes.js";
import { createRoomRoutes } from "./routes/roomRoutes.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { FeedbackService } from "./services/FeedbackService.js";
import { ChatService } from "./services/ChatService.js";
import { AnthropicAdapter } from "./services/ai/AnthropicAdapter.js";
import { ClientManagerBroadcaster } from "./services/MessageBroadcaster.js";
import { setupWebSocketHandlers } from "./handlers/websocketHandler.js";
import { createProblemRepository } from "./repositories/ProblemRepository.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app and servers
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({
  server,
  verifyClient: (info: { origin: string; req: any }) => {
    const origin = info.origin;
    return !origin || config.allowedOrigins.includes(origin);
  },
});

// Initialize state manager and room registry (Redis or in-memory)
let stateManager: AsyncStateManager;
let roomRegistry: RoomRegistry;
if (config.redis.url) {
  const redisClient = createRedisClient({
    url: config.redis.url,
    keyPrefix: config.redis.keyPrefix,
  });
  stateManager = new RedisStateManager(redisClient);
  roomRegistry = new RedisRoomRegistry(redisClient);
  console.log(`[Server] Using Redis state manager: ${config.redis.url}`);
} else {
  stateManager = new MultiRoomStateManager(100);
  roomRegistry = new InMemoryRoomRegistry(100);
  console.log("[Server] Using in-memory state manager");
}

const clientManager = new MultiRoomClientManager();
const yjsDocManager = new YjsDocManager(clientManager, 100);
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});
const aiClient = new AnthropicAdapter(anthropic);
const broadcaster = new ClientManagerBroadcaster(clientManager);
const problemRepository = createProblemRepository();

const feedbackService = new FeedbackService({
  aiClient,
  stateManager,
  yjsDocManager,
  broadcaster,
  usageProvider,
  problemRepository,
  claudeModel: process.env.CLAUDE_MODEL,
});

const chatService = new ChatService({
  aiClient,
  stateManager,
  usageProvider,
  problemRepository,
  claudeModel: process.env.CLAUDE_MODEL,
});

// Middleware
app.use(
  cors({
    origin: config.allowedOrigins,
    credentials: true,
  })
);

// Register auth routes before JSON parser (webhooks need raw body)
await registerAuthRoutes(app, clientManager);

// JSON parser for all other routes
app.use(express.json());

// Auth middleware - extracts userId from request
app.use(authMiddleware);

// Helper function for constructing share URLs
const getBaseUrl = (): string => {
  return process.env.BASE_URL || `http://${config.host}:${config.port}`;
};

// Health check endpoint
app.get("/api/health", async (req: Request, res: Response) => {
  const roomCount = await stateManager.getRoomCount();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    roomCount,
    totalClients: clientManager
      .getAllRooms()
      .reduce((sum, room) => sum + clientManager.getClientCount(room), 0),
    redisEnabled: !!config.redis.url,
  });
});

// Register element routes
app.use(createElementRoutes({ stateManager, clientManager }));

// Register problem routes
app.use("/api/problems", createProblemRoutes());

// Register room routes
app.use(createRoomRoutes({ roomRegistry, stateManager, yjsDocManager, getBaseUrl }));

// Setup WebSocket handlers
setupWebSocketHandlers({ wss, stateManager, clientManager, yjsDocManager, feedbackService, chatService, roomRegistry });

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  const clientPath = path.join(__dirname, "../../client");

  // Hashed assets (JS/CSS) can be cached forever - Vite includes content hash in filename
  app.use(
    "/assets",
    express.static(path.join(clientPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    })
  );

  // Other static files with short cache
  app.use(express.static(clientPath, { maxAge: "1h" }));

  // SPA fallback - index.html should never be cached
  app.get("*", (_req: Request, res: Response) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

server.listen(config.port, config.host, () => {
  console.log(`Server running on http://${config.host}:${config.port}`);
  console.log(`WebSocket server running on ws://${config.host}:${config.port}`);
  console.log(`Auth enabled: ${config.enableAuth}`);
});

export default app;
