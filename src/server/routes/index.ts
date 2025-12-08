import type { Express } from "express";
import type { MultiRoomClientManager } from "../managers/MultiRoomClientManager.js";

export async function registerAuthRoutes(
  _app: Express,
  _clientManager: MultiRoomClientManager
): Promise<void> {
  return;
}
