import { describe, it, expect, vi, beforeEach } from "vitest";
import { MultiRoomClientManager } from "./MultiRoomClientManager.js";
import type { WebSocket } from "ws";

// Mock WebSocket
function createMockWebSocket(readyState = 1): WebSocket {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
}

describe("MultiRoomClientManager", () => {
  let manager: MultiRoomClientManager;

  beforeEach(() => {
    manager = new MultiRoomClientManager();
  });

  describe("addClient", () => {
    it("adds client to specified room", () => {
      const ws = createMockWebSocket();
      manager.addClient(ws, "room1");

      expect(manager.getClients("room1").has(ws)).toBe(true);
    });

    it("creates room if it does not exist", () => {
      const ws = createMockWebSocket();
      manager.addClient(ws, "newRoom");

      expect(manager.getRoomCount()).toBe(1);
      expect(manager.getAllRooms()).toContain("newRoom");
    });

    it("throws error if roomId is not provided", () => {
      const ws = createMockWebSocket();

      expect(() => manager.addClient(ws)).toThrow(
        "roomId is required for MultiRoomClientManager"
      );
    });

    it("moves client to new room if already in a room", () => {
      const ws = createMockWebSocket();
      manager.addClient(ws, "room1");
      manager.addClient(ws, "room2");

      expect(manager.getClients("room1").has(ws)).toBe(false);
      expect(manager.getClients("room2").has(ws)).toBe(true);
    });

    it("cleans up empty room when client moves", () => {
      const ws = createMockWebSocket();
      manager.addClient(ws, "room1");
      manager.addClient(ws, "room2");

      expect(manager.getAllRooms()).not.toContain("room1");
    });
  });

  describe("removeClient", () => {
    it("removes client from room", () => {
      const ws = createMockWebSocket();
      manager.addClient(ws, "room1");
      manager.removeClient(ws);

      expect(manager.getClients("room1").has(ws)).toBe(false);
    });

    it("cleans up empty room after removal", () => {
      const ws = createMockWebSocket();
      manager.addClient(ws, "room1");
      manager.removeClient(ws);

      expect(manager.getRoomCount()).toBe(0);
    });

    it("does nothing for client not in any room", () => {
      const ws = createMockWebSocket();
      manager.removeClient(ws);

      expect(manager.getRoomCount()).toBe(0);
    });

    it("keeps room if other clients remain", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      manager.addClient(ws1, "room1");
      manager.addClient(ws2, "room1");
      manager.removeClient(ws1);

      expect(manager.getRoomCount()).toBe(1);
      expect(manager.getClients("room1").has(ws2)).toBe(true);
    });
  });

  describe("getClients", () => {
    it("returns clients in specified room", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      manager.addClient(ws1, "room1");
      manager.addClient(ws2, "room1");

      const clients = manager.getClients("room1");

      expect(clients.size).toBe(2);
      expect(clients.has(ws1)).toBe(true);
      expect(clients.has(ws2)).toBe(true);
    });

    it("returns empty set for non-existent room", () => {
      const clients = manager.getClients("nonExistent");

      expect(clients.size).toBe(0);
    });

    it("throws error if roomId is not provided", () => {
      expect(() => manager.getClients()).toThrow(
        "roomId is required for MultiRoomClientManager"
      );
    });
  });

  describe("getRoomForClient", () => {
    it("returns room id for client", () => {
      const ws = createMockWebSocket();
      manager.addClient(ws, "room1");

      expect(manager.getRoomForClient(ws)).toBe("room1");
    });

    it("returns undefined for client not in any room", () => {
      const ws = createMockWebSocket();

      expect(manager.getRoomForClient(ws)).toBeUndefined();
    });
  });

  describe("broadcast", () => {
    it("sends message to all clients in room", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      manager.addClient(ws1, "room1");
      manager.addClient(ws2, "room1");

      manager.broadcast({ type: "test", data: "hello" }, "room1");

      expect(ws1.send).toHaveBeenCalledWith('{"type":"test","data":"hello"}');
      expect(ws2.send).toHaveBeenCalledWith('{"type":"test","data":"hello"}');
    });

    it("excludes specified client from broadcast", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      manager.addClient(ws1, "room1");
      manager.addClient(ws2, "room1");

      manager.broadcast({ type: "test" }, "room1", ws1);

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it("does not send to clients with non-OPEN readyState", () => {
      const wsOpen = createMockWebSocket(1); // OPEN
      const wsClosed = createMockWebSocket(3); // CLOSED
      manager.addClient(wsOpen, "room1");
      manager.addClient(wsClosed, "room1");

      manager.broadcast({ type: "test" }, "room1");

      expect(wsOpen.send).toHaveBeenCalled();
      expect(wsClosed.send).not.toHaveBeenCalled();
    });

    it("throws error if roomId is not provided", () => {
      expect(() => manager.broadcast({ type: "test" })).toThrow(
        "roomId is required for MultiRoomClientManager"
      );
    });

    it("does nothing for empty room", () => {
      manager.broadcast({ type: "test" }, "emptyRoom");
      // No error thrown
    });
  });

  describe("broadcastToUser", () => {
    it("broadcasts to all rooms starting with userId/", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      manager.addClient(ws1, "user123/problem1");
      manager.addClient(ws2, "user123/problem2");

      manager.broadcastToUser("user123", { type: "test" });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it("broadcasts to user landing page room", () => {
      const ws = createMockWebSocket();
      manager.addClient(ws, "user/user123");

      manager.broadcastToUser("user123", { type: "test" });

      expect(ws.send).toHaveBeenCalled();
    });

    it("does not broadcast to other users rooms", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      manager.addClient(ws1, "user123/problem1");
      manager.addClient(ws2, "user456/problem1");

      manager.broadcastToUser("user123", { type: "test" });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it("does not send to clients with non-OPEN readyState", () => {
      const wsClosed = createMockWebSocket(3);
      manager.addClient(wsClosed, "user123/problem1");

      manager.broadcastToUser("user123", { type: "test" });

      expect(wsClosed.send).not.toHaveBeenCalled();
    });
  });

  describe("getRoomCount", () => {
    it("returns number of active rooms", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      manager.addClient(ws1, "room1");
      manager.addClient(ws2, "room2");

      expect(manager.getRoomCount()).toBe(2);
    });

    it("returns 0 when no rooms", () => {
      expect(manager.getRoomCount()).toBe(0);
    });
  });

  describe("getClientCount", () => {
    it("returns number of clients in room", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      manager.addClient(ws1, "room1");
      manager.addClient(ws2, "room1");

      expect(manager.getClientCount("room1")).toBe(2);
    });

    it("returns 0 for non-existent room", () => {
      expect(manager.getClientCount("nonExistent")).toBe(0);
    });
  });

  describe("getAllRooms", () => {
    it("returns array of all room ids", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      manager.addClient(ws1, "room1");
      manager.addClient(ws2, "room2");

      const rooms = manager.getAllRooms();

      expect(rooms).toContain("room1");
      expect(rooms).toContain("room2");
      expect(rooms).toHaveLength(2);
    });

    it("returns empty array when no rooms", () => {
      expect(manager.getAllRooms()).toEqual([]);
    });
  });
});
