import { Router, Request, Response } from 'express';
import type { RoomRegistry } from '../registries/types.js';

interface RoomRoutesDependencies {
  roomRegistry: RoomRegistry;
  getBaseUrl: () => string;
}

export function createRoomRoutes(deps: RoomRoutesDependencies): Router {
  const { roomRegistry, getBaseUrl } = deps;
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
      console.error('Error resolving token:', error);
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
      console.error('Error getting room:', error);
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
      console.error('Error creating room:', error);
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
      console.error('Error regenerating token:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  return router;
}
