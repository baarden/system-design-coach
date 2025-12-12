import { Router, Request, Response } from "express";
import type { ServerElement } from "../../shared/types/excalidraw.js";
import type { AsyncStateManager } from "../managers/types.js";
import { MultiRoomClientManager } from "../managers/MultiRoomClientManager.js";
import { logger } from "../utils/logger.js";

interface ElementRoutesDependencies {
  stateManager: AsyncStateManager;
  clientManager: MultiRoomClientManager;
}

export function createElementRoutes(deps: ElementRoutesDependencies): Router {
  const { stateManager, clientManager } = deps;
  const router = Router();

  // Get all elements for a room
  router.get("/api/elements/*", async (req: Request, res: Response) => {
    try {
      const roomId = req.params[0];
      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: "roomId path parameter is required",
        });
      }

      const elements = await stateManager.getElements(roomId);
      // Strip 'index' property to let Excalidraw regenerate valid fractional indices
      const elementsArray = Array.from(elements.values()).map(({ index, ...rest }: any) => rest);
      res.json({
        success: true,
        elements: elementsArray,
        count: elementsArray.length,
        roomId,
      });
    } catch (error) {
      logger.error("Error fetching elements", { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Sync endpoint with path parameter
  router.post("/api/elements/sync/*", async (req: Request, res: Response) => {
    try {
      const roomId = req.params[0];
      const { elements: frontendElements, timestamp } = req.body;

      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: "roomId path parameter is required",
        });
      }

      if (!Array.isArray(frontendElements)) {
        return res.status(400).json({
          success: false,
          error: "Expected elements to be an array",
        });
      }

      const beforeElements = await stateManager.getElements(roomId);
      const beforeCount = beforeElements.size;

      // Clear and sync elements
      await stateManager.clearElements(roomId);

      let successCount = 0;
      for (const element of frontendElements as ServerElement[]) {
        const elementId = element.id;
        const processedElement: ServerElement = {
          ...element,
          id: elementId,
          syncedAt: new Date().toISOString(),
          syncTimestamp: timestamp,
          version: 1,
        };

        await stateManager.setElement(elementId, processedElement, roomId);
        successCount++;
      }

      // Broadcast sync event to all WebSocket clients in the room
      clientManager.broadcast(
        {
          type: "elements_synced",
          count: successCount,
          timestamp: new Date().toISOString(),
        },
        roomId
      );

      const afterElements = await stateManager.getElements(roomId);

      res.json({
        success: true,
        message: `Successfully synced ${successCount} elements`,
        count: successCount,
        syncedAt: new Date().toISOString(),
        beforeCount,
        afterCount: afterElements.size,
        roomId,
      });
    } catch (error) {
      logger.error("Sync error", { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  return router;
}
