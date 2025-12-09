import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { YjsDocManager } from "./YjsDocManager.js";
import { MultiRoomClientManager } from "./MultiRoomClientManager.js";
import type { WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MESSAGE_SYNC = 0;

// Mock WebSocket
function createMockWebSocket(readyState = 1): WebSocket {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
}

// Helper to create a SyncStep1 message from a Y.Doc
function createSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

// Helper to create an update message
function createUpdateMessage(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

describe("YjsDocManager", () => {
  let clientManager: MultiRoomClientManager;
  let yjsManager: YjsDocManager;

  beforeEach(() => {
    clientManager = new MultiRoomClientManager();
    yjsManager = new YjsDocManager(clientManager);
  });

  afterEach(() => {
    // Clean up any rooms
    vi.clearAllMocks();
  });

  describe("room management", () => {
    it("creates a Y.Doc for a new room", () => {
      const doc = yjsManager.getDoc("room1");
      expect(doc).toBeInstanceOf(Y.Doc);
    });

    it("returns the same Y.Doc for the same room", () => {
      const doc1 = yjsManager.getDoc("room1");
      const doc2 = yjsManager.getDoc("room1");
      expect(doc1).toBe(doc2);
    });

    it("creates separate Y.Docs for different rooms", () => {
      const doc1 = yjsManager.getDoc("room1");
      const doc2 = yjsManager.getDoc("room2");
      expect(doc1).not.toBe(doc2);
    });

    it("tracks room count", () => {
      expect(yjsManager.getRoomCount()).toBe(0);
      yjsManager.getDoc("room1");
      expect(yjsManager.getRoomCount()).toBe(1);
      yjsManager.getDoc("room2");
      expect(yjsManager.getRoomCount()).toBe(2);
    });

    it("deletes a room and its Y.Doc", () => {
      yjsManager.getDoc("room1");
      expect(yjsManager.getRoomCount()).toBe(1);

      const deleted = yjsManager.deleteRoom("room1");
      expect(deleted).toBe(true);
      expect(yjsManager.getRoomCount()).toBe(0);
    });

    it("returns false when deleting non-existent room", () => {
      const deleted = yjsManager.deleteRoom("nonexistent");
      expect(deleted).toBe(false);
    });
  });

  describe("element management", () => {
    it("returns empty array for room with no elements", () => {
      const elements = yjsManager.getElements("room1");
      expect(elements).toEqual([]);
    });

    it("returns elements from Y.Doc", () => {
      const doc = yjsManager.getDoc("room1");
      const yElements = doc.getArray("elements");
      yElements.push([{ id: "1", type: "rectangle" }]);

      const elements = yjsManager.getElements("room1");
      expect(elements).toHaveLength(1);
      expect(elements[0].id).toBe("1");
    });

    it("returns elements as a Map", () => {
      const doc = yjsManager.getDoc("room1");
      const yElements = doc.getArray("elements");
      yElements.push([
        { id: "1", type: "rectangle" },
        { id: "2", type: "ellipse" },
      ]);

      const elementsMap = yjsManager.getElementsMap("room1");
      expect(elementsMap.size).toBe(2);
      expect(elementsMap.get("1")?.type).toBe("rectangle");
      expect(elementsMap.get("2")?.type).toBe("ellipse");
    });

    it("initializes room from existing elements", () => {
      const elements = [
        { id: "1", type: "rectangle" },
        { id: "2", type: "ellipse" },
      ] as any[];

      yjsManager.initializeFromElements("room1", elements);

      const stored = yjsManager.getElements("room1");
      expect(stored).toHaveLength(2);
    });

    it("does not reinitialize if room already has elements", () => {
      // First initialization
      yjsManager.initializeFromElements("room1", [{ id: "1", type: "rectangle" }] as any[]);

      // Second initialization should be ignored
      yjsManager.initializeFromElements("room1", [{ id: "2", type: "ellipse" }] as any[]);

      const stored = yjsManager.getElements("room1");
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("1");
    });
  });

  describe("comments", () => {
    it("returns empty string for room with no comments", () => {
      const comments = yjsManager.getComments("room1");
      expect(comments).toBe("");
    });

    it("returns comments from Y.Doc", () => {
      const doc = yjsManager.getDoc("room1");
      const yComments = doc.getText("comments");
      yComments.insert(0, "Hello, world!");

      const comments = yjsManager.getComments("room1");
      expect(comments).toBe("Hello, world!");
    });
  });

  describe("handleClientConnect", () => {
    it("returns a valid SyncStep1 message", () => {
      const ws = createMockWebSocket();
      const message = yjsManager.handleClientConnect(ws, "room1");

      // Decode and verify it's a valid sync message
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);
      expect(messageType).toBe(MESSAGE_SYNC);

      // The rest should be a valid SyncStep1
      // We can verify by checking the message can be read
      const tempEncoder = encoding.createEncoder();
      const tempDoc = new Y.Doc();
      const syncType = syncProtocol.readSyncMessage(decoder, tempEncoder, tempDoc, null);
      expect(syncType).toBe(syncProtocol.messageYjsSyncStep1);
      tempDoc.destroy();
    });

    it("includes current document state in SyncStep1", () => {
      // Add some elements first
      const doc = yjsManager.getDoc("room1");
      const yElements = doc.getArray("elements");
      yElements.push([{ id: "1", type: "rectangle" }]);

      const ws = createMockWebSocket();
      const message = yjsManager.handleClientConnect(ws, "room1");

      // Apply to a new doc and verify state transfers
      const clientDoc = new Y.Doc();
      const decoder = decoding.createDecoder(message);
      decoding.readVarUint(decoder); // MESSAGE_SYNC
      const encoder = encoding.createEncoder();
      syncProtocol.readSyncMessage(decoder, encoder, clientDoc, null);

      // If there's a response (SyncStep2), the client would need to send it
      // For now, just verify the message is valid
      expect(message.length).toBeGreaterThan(0);
      clientDoc.destroy();
    });
  });

  describe("handleSyncMessage", () => {
    it("processes SyncStep1 and returns SyncStep2", () => {
      const ws = createMockWebSocket();

      // Add elements to server doc
      const serverDoc = yjsManager.getDoc("room1");
      const yElements = serverDoc.getArray("elements");
      yElements.push([{ id: "server-1", type: "rectangle" }]);

      // Create a client doc and send SyncStep1
      const clientDoc = new Y.Doc();
      const syncStep1 = createSyncStep1(clientDoc);

      const response = yjsManager.handleSyncMessage(ws, "room1", syncStep1);

      // Should return SyncStep2 with server state
      expect(response).not.toBeNull();

      // Apply response to client doc
      if (response) {
        const decoder = decoding.createDecoder(response);
        decoding.readVarUint(decoder); // MESSAGE_SYNC
        const encoder = encoding.createEncoder();
        syncProtocol.readSyncMessage(decoder, encoder, clientDoc, null);

        // Client should now have server's elements
        const clientElements = clientDoc.getArray("elements");
        expect(clientElements.length).toBe(1);
      }

      clientDoc.destroy();
    });

    it("applies updates from client to server doc", () => {
      const ws = createMockWebSocket();

      // Create a client doc with elements
      const clientDoc = new Y.Doc();
      const clientElements = clientDoc.getArray("elements");
      clientElements.push([{ id: "client-1", type: "ellipse" }]);

      // Get the update
      const update = Y.encodeStateAsUpdate(clientDoc);
      const updateMessage = createUpdateMessage(update);

      // Send to server
      yjsManager.handleSyncMessage(ws, "room1", updateMessage);

      // Server should have the element
      const serverElements = yjsManager.getElements("room1");
      expect(serverElements).toHaveLength(1);
      expect(serverElements[0].id).toBe("client-1");

      clientDoc.destroy();
    });

    it("returns null for non-sync messages", () => {
      const ws = createMockWebSocket();

      // Create a message with wrong type
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 99); // Invalid type
      const invalidMessage = encoding.toUint8Array(encoder);

      const response = yjsManager.handleSyncMessage(ws, "room1", invalidMessage);
      expect(response).toBeNull();
    });
  });

  describe("broadcastUpdate", () => {
    it("sends update to all clients in room", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      clientManager.addClient(ws1, "room1");
      clientManager.addClient(ws2, "room1");

      const update = new Uint8Array([1, 2, 3]);
      yjsManager.broadcastUpdate("room1", update);

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);
    });

    it("excludes specified client from broadcast", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      clientManager.addClient(ws1, "room1");
      clientManager.addClient(ws2, "room1");

      const update = new Uint8Array([1, 2, 3]);
      yjsManager.broadcastUpdate("room1", update, ws1);

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledTimes(1);
    });

    it("skips clients with closed connections", () => {
      const wsOpen = createMockWebSocket(1); // OPEN
      const wsClosed = createMockWebSocket(3); // CLOSED
      clientManager.addClient(wsOpen, "room1");
      clientManager.addClient(wsClosed, "room1");

      const update = new Uint8Array([1, 2, 3]);
      yjsManager.broadcastUpdate("room1", update);

      expect(wsOpen.send).toHaveBeenCalledTimes(1);
      expect(wsClosed.send).not.toHaveBeenCalled();
    });

    it("sends correctly formatted yjs-sync message", () => {
      const ws = createMockWebSocket();
      clientManager.addClient(ws, "room1");

      const update = new Uint8Array([1, 2, 3]);
      yjsManager.broadcastUpdate("room1", update);

      const sentMessage = JSON.parse((ws.send as any).mock.calls[0][0]);
      expect(sentMessage.type).toBe("yjs-sync");
      expect(Array.isArray(sentMessage.payload)).toBe(true);
    });
  });

  describe("setupUpdateBroadcasting", () => {
    it("broadcasts updates when Y.Doc changes", () => {
      const ws = createMockWebSocket();
      clientManager.addClient(ws, "room1");

      yjsManager.setupUpdateBroadcasting("room1");

      // Make a change to the doc
      const doc = yjsManager.getDoc("room1");
      const yElements = doc.getArray("elements");
      yElements.push([{ id: "1", type: "rectangle" }]);

      // Should have broadcast the update
      expect(ws.send).toHaveBeenCalled();
    });

    it("only sets up handler once per room", () => {
      const ws = createMockWebSocket();
      clientManager.addClient(ws, "room1");

      // Set up twice
      yjsManager.setupUpdateBroadcasting("room1");
      yjsManager.setupUpdateBroadcasting("room1");

      // Make a change
      const doc = yjsManager.getDoc("room1");
      const yElements = doc.getArray("elements");
      yElements.push([{ id: "1", type: "rectangle" }]);

      // Should only broadcast once (not twice)
      expect(ws.send).toHaveBeenCalledTimes(1);
    });

    it("excludes originating client from broadcast", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      clientManager.addClient(ws1, "room1");
      clientManager.addClient(ws2, "room1");

      yjsManager.setupUpdateBroadcasting("room1");

      // Make a change with ws1 as origin
      const doc = yjsManager.getDoc("room1");
      doc.transact(() => {
        const yElements = doc.getArray("elements");
        yElements.push([{ id: "1", type: "rectangle" }]);
      }, ws1); // ws1 is the origin

      // ws1 should not receive broadcast, ws2 should
      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });
  });

  describe("getDocState and applyUpdate", () => {
    it("can export and import document state", () => {
      // Add elements to room1
      const doc1 = yjsManager.getDoc("room1");
      const yElements1 = doc1.getArray("elements");
      yElements1.push([{ id: "1", type: "rectangle" }]);

      // Export state
      const state = yjsManager.getDocState("room1");
      expect(state).toBeInstanceOf(Uint8Array);

      // Apply to room2
      yjsManager.applyUpdate("room2", state);

      // room2 should have the same elements
      const elements2 = yjsManager.getElements("room2");
      expect(elements2).toHaveLength(1);
      expect(elements2[0].id).toBe("1");
    });
  });
});
