import { Router, Request, Response } from 'express';
import type { RoomRegistry } from '../registries/types.js';
import type { AsyncStateManager } from '../managers/types.js';
import type { YjsDocManager } from '../managers/YjsDocManager.js';
import type { RoomResponse, TokenRegenerateResponse, ResetRoomResponse } from '@shared/types/api';
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
        const response: RoomResponse = {
          success: false,
          error: 'Invalid or expired share link',
        };
        return res.status(404).json(response);
      }

      const response: RoomResponse = {
        success: true,
        room: {
          roomId: metadata.roomId,
          problemId: metadata.problemId,
        },
      };
      res.json(response);
    } catch (error) {
      logger.error('Error resolving token', { error: (error as Error).message });
      const response: RoomResponse = {
        success: false,
        error: (error as Error).message,
      };
      res.status(500).json(response);
    }
  });

  // Get room metadata and share URL (owner access via URL)
  router.get('/api/rooms/:user/:problemId', async (req: Request, res: Response) => {
    try {
      const { user, problemId } = req.params;
      const roomId = `${user}/${problemId}`;

      const metadata = await roomRegistry.getRoomMetadata(roomId);
      if (!metadata) {
        const response: RoomResponse = {
          success: false,
          error: 'Room not found',
        };
        return res.status(404).json(response);
      }

      const shareUrl = `${getBaseUrl()}/room/${metadata.shareToken}`;

      const response: RoomResponse = {
        success: true,
        room: {
          roomId: metadata.roomId,
          problemId: metadata.problemId,
          shareUrl,
          createdAt: metadata.createdAt,
          tokenCreatedAt: metadata.tokenCreatedAt,
        },
      };
      res.json(response);
    } catch (error) {
      logger.error('Error getting room', { error: (error as Error).message });
      const response: RoomResponse = {
        success: false,
        error: (error as Error).message,
      };
      res.status(500).json(response);
    }
  });

  // Create room (creates token)
  router.post('/api/rooms/:user/:problemId', async (req: Request, res: Response) => {
    try {
      const { user, problemId } = req.params;

      const metadata = await roomRegistry.createRoom(user, problemId);
      const shareUrl = `${getBaseUrl()}/room/${metadata.shareToken}`;

      const response: RoomResponse = {
        success: true,
        room: {
          roomId: metadata.roomId,
          problemId: metadata.problemId,
          shareUrl,
          createdAt: metadata.createdAt,
        },
      };
      res.json(response);
    } catch (error) {
      logger.error('Error creating room', { error: (error as Error).message });
      const response: RoomResponse = {
        success: false,
        error: (error as Error).message,
      };
      res.status(500).json(response);
    }
  });

  // Regenerate share token
  router.post('/api/rooms/:user/:problemId/regenerate-token', async (req: Request, res: Response) => {
    try {
      const { user, problemId } = req.params;
      const roomId = `${user}/${problemId}`;

      const newToken = await roomRegistry.regenerateToken(roomId, user);
      const shareUrl = `${getBaseUrl()}/room/${newToken}`;

      const response: TokenRegenerateResponse = {
        success: true,
        shareUrl,
        message: 'Token regenerated. Old share links are now invalid.',
      };
      res.json(response);
    } catch (error) {
      logger.error('Error regenerating token', { error: (error as Error).message });
      const response: TokenRegenerateResponse = {
        success: false,
        error: (error as Error).message,
      };
      res.status(500).json(response);
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

      const response: ResetRoomResponse = {
        success: true,
        message: 'Room content has been reset',
      };
      res.json(response);
    } catch (error) {
      logger.error('Error resetting room', { error: (error as Error).message });
      const response: ResetRoomResponse = {
        success: false,
        error: (error as Error).message,
      };
      res.status(500).json(response);
    }
  });

  return router;
}
