import { Router, Request, Response } from 'express';
import type { RoomRegistry } from '../registries/types.js';
import type { AsyncStateManager } from '../managers/types.js';
import type { YjsDocManager } from '../managers/YjsDocManager.js';
import { logger } from '../utils/logger.js';

interface RoomRoutesDependencies {
  roomRegistry: RoomRegistry;
  stateManager: AsyncStateManager;
  yjsDocManager: YjsDocManager;
  getBaseUrl: () => string;
}

export function createRoomRoutes(deps: RoomRoutesDependencies): Router {
  const { roomRegistry, stateManager, yjsDocManager, getBaseUrl } = deps;
  const router = Router();

  // Resolve token to room (public, for guest access)
  // IMPORTANT: This route must come BEFORE parameterized routes to avoid matching as :user/:problemId
  router.get('/api/rooms/by-token/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      const metadata = await roomRegistry.getRoomByToken(token);
      if (!metadata) {
        return res.status(404).json({
          success: false,
          error: 'Invalid or expired share link',
        });
      }

      res.json({
        success: true,
        room: {
          roomId: metadata.roomId,
          problemId: metadata.problemId,
        },
      });
    } catch (error) {
      logger.error('Error resolving token', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Get room metadata and share URL (owner access via URL)
  router.get('/api/rooms/:user/:problemId', async (req: Request, res: Response) => {
    try {
      const { user, problemId } = req.params;
      const roomId = `${user}/${problemId}`;

      const metadata = await roomRegistry.getRoomMetadata(roomId);
      if (!metadata) {
        return res.status(404).json({
          success: false,
          error: 'Room not found',
        });
      }

      const shareUrl = `${getBaseUrl()}/room/${metadata.shareToken}`;

      res.json({
        success: true,
        room: {
          roomId: metadata.roomId,
          problemId: metadata.problemId,
          shareUrl,
          createdAt: metadata.createdAt,
          tokenCreatedAt: metadata.tokenCreatedAt,
        },
      });
    } catch (error) {
      logger.error('Error getting room', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Create room (creates token)
  router.post('/api/rooms/:user/:problemId', async (req: Request, res: Response) => {
    try {
      const { user, problemId } = req.params;

      const metadata = await roomRegistry.createRoom(user, problemId);
      const shareUrl = `${getBaseUrl()}/room/${metadata.shareToken}`;

      res.json({
        success: true,
        room: {
          roomId: metadata.roomId,
          shareUrl,
          createdAt: metadata.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error creating room', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Regenerate share token
  router.post('/api/rooms/:user/:problemId/regenerate-token', async (req: Request, res: Response) => {
    try {
      const { user, problemId } = req.params;
      const roomId = `${user}/${problemId}`;

      const newToken = await roomRegistry.regenerateToken(roomId, user);
      const shareUrl = `${getBaseUrl()}/room/${newToken}`;

      res.json({
        success: true,
        shareUrl,
        message: 'Token regenerated. Old share links are now invalid.',
      });
    } catch (error) {
      logger.error('Error regenerating token', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Reset room content (elements + conversation)
  router.delete('/api/rooms/:user/:problemId/content', async (req: Request, res: Response) => {
    try {
      const { user, problemId } = req.params;
      const roomId = `${user}/${problemId}`;

      // Clear room content (elements + conversation)
      await stateManager.deleteRoom(roomId);

      // Clear Yjs document state
      yjsDocManager.deleteRoom(roomId);

      logger.info('Room content reset', { roomId });

      res.json({
        success: true,
        message: 'Room content has been reset',
      });
    } catch (error) {
      logger.error('Error resetting room', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  return router;
}
