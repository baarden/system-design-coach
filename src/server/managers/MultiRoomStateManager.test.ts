import { describe, it, expect, beforeEach } from "vitest";
import { MultiRoomStateManager } from "./MultiRoomStateManager.js";
import type { ServerElement } from "../../shared/types/excalidraw.js";

function createTestElement(id: string): ServerElement {
  return {
    id,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    angle: 0,
    strokeColor: "#000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    versionNonce: 1,
    isDeleted: false,
    locked: false,
    link: null,
    version: 1,
  };
}

describe("MultiRoomStateManager", () => {
  let manager: MultiRoomStateManager;

  beforeEach(() => {
    manager = new MultiRoomStateManager(100);
  });

  describe("element operations", () => {
    describe("getElements", () => {
      it("returns empty map for new room", async () => {
        const elements = await manager.getElements("newRoom");
        expect(elements.size).toBe(0);
      });

      it("returns elements map for existing room", async () => {
        const element = createTestElement("elem1");
        await manager.setElement("elem1", element, "room1");

        const elements = await manager.getElements("room1");

        expect(elements.size).toBe(1);
        expect(elements.get("elem1")).toEqual(element);
      });
    });

    describe("getElement", () => {
      it("returns element by id", async () => {
        const element = createTestElement("elem1");
        await manager.setElement("elem1", element, "room1");

        const result = await manager.getElement("elem1", "room1");

        expect(result).toEqual(element);
      });

      it("returns undefined for non-existent element", async () => {
        const result = await manager.getElement("nonExistent", "room1");
        expect(result).toBeUndefined();
      });
    });

    describe("setElement", () => {
      it("adds new element to room", async () => {
        const element = createTestElement("elem1");
        await manager.setElement("elem1", element, "room1");

        const result = await manager.getElement("elem1", "room1");
        expect(result).toEqual(element);
      });

      it("updates existing element", async () => {
        const element1 = createTestElement("elem1");
        await manager.setElement("elem1", element1, "room1");

        const element2 = { ...element1, x: 50 };
        await manager.setElement("elem1", element2, "room1");

        const result = await manager.getElement("elem1", "room1");
        expect(result?.x).toBe(50);
      });
    });

    describe("deleteElement", () => {
      it("removes element from room", async () => {
        const element = createTestElement("elem1");
        await manager.setElement("elem1", element, "room1");

        const deleted = await manager.deleteElement("elem1", "room1");

        expect(deleted).toBe(true);
        expect(await manager.getElement("elem1", "room1")).toBeUndefined();
      });

      it("returns false for non-existent element", async () => {
        const deleted = await manager.deleteElement("nonExistent", "room1");
        expect(deleted).toBe(false);
      });
    });

    describe("clearElements", () => {
      it("removes all elements from room", async () => {
        await manager.setElement("elem1", createTestElement("elem1"), "room1");
        await manager.setElement("elem2", createTestElement("elem2"), "room1");

        await manager.clearElements("room1");

        const elements = await manager.getElements("room1");
        expect(elements.size).toBe(0);
      });
    });

    describe("getElementCount", () => {
      it("returns number of elements in room", async () => {
        await manager.setElement("elem1", createTestElement("elem1"), "room1");
        await manager.setElement("elem2", createTestElement("elem2"), "room1");

        const count = await manager.getElementCount("room1");
        expect(count).toBe(2);
      });

      it("returns 0 for empty room", async () => {
        const count = await manager.getElementCount("emptyRoom");
        expect(count).toBe(0);
      });
    });
  });

  describe("room operations", () => {
    describe("deleteRoom", () => {
      it("removes room and its elements", async () => {
        await manager.setElement("elem1", createTestElement("elem1"), "room1");

        const deleted = await manager.deleteRoom("room1");

        expect(deleted).toBe(true);
        expect(await manager.getRoomCount()).toBe(0);
      });

      it("removes room and its conversation", async () => {
        await manager.initializeConversation(
          "room1",
          "problem1",
          "Test statement"
        );

        await manager.deleteRoom("room1");

        const conversation = await manager.getConversation("room1");
        expect(conversation).toBeUndefined();
      });

      it("returns false for non-existent room", async () => {
        const deleted = await manager.deleteRoom("nonExistent");
        expect(deleted).toBe(false);
      });
    });

    describe("getRoomCount", () => {
      it("returns number of active rooms", async () => {
        await manager.setElement("elem1", createTestElement("elem1"), "room1");
        await manager.setElement("elem2", createTestElement("elem2"), "room2");

        const count = await manager.getRoomCount();
        expect(count).toBe(2);
      });
    });
  });

  describe("conversation operations", () => {
    describe("initializeConversation", () => {
      it("creates conversation with initial message", async () => {
        const state = await manager.initializeConversation(
          "room1",
          "problem1",
          "Design a URL shortener"
        );

        expect(state.problemId).toBe("problem1");
        expect(state.messages).toHaveLength(1);
        expect(state.messages[0].role).toBe("assistant");
        expect(state.messages[0].content).toBe("Design a URL shortener");
        expect(state.messages[0].source).toBe("feedback");
        expect(state.previousElements).toEqual({});
      });

      it("includes timestamp in initial message", async () => {
        const before = new Date().toISOString();
        const state = await manager.initializeConversation(
          "room1",
          "problem1",
          "Test"
        );
        const after = new Date().toISOString();

        expect(state.messages[0].timestamp >= before).toBe(true);
        expect(state.messages[0].timestamp <= after).toBe(true);
      });
    });

    describe("getConversation", () => {
      it("returns conversation state", async () => {
        await manager.initializeConversation(
          "room1",
          "problem1",
          "Test statement"
        );

        const state = await manager.getConversation("room1");

        expect(state?.problemId).toBe("problem1");
      });

      it("returns undefined for non-existent conversation", async () => {
        const state = await manager.getConversation("nonExistent");
        expect(state).toBeUndefined();
      });
    });

    describe("addMessage", () => {
      it("adds message to conversation", async () => {
        await manager.initializeConversation(
          "room1",
          "problem1",
          "Test statement"
        );

        await manager.addMessage("room1", {
          role: "user",
          content: "My design has a database",
          timestamp: new Date().toISOString(),
          source: "feedback",
        });

        const state = await manager.getConversation("room1");
        expect(state?.messages).toHaveLength(2);
        expect(state?.messages[1].content).toBe("My design has a database");
      });

      it("throws error for non-existent conversation", async () => {
        await expect(
          manager.addMessage("nonExistent", {
            role: "user",
            content: "Test",
            timestamp: new Date().toISOString(),
            source: "chat",
          })
        ).rejects.toThrow("No conversation state for room: nonExistent");
      });
    });

    describe("getPreviousElements", () => {
      it("returns previous elements from conversation", async () => {
        await manager.initializeConversation(
          "room1",
          "problem1",
          "Test statement"
        );
        await manager.setPreviousElements("room1", {
          elem1: { id: "elem1", type: "rectangle" },
        });

        const elements = await manager.getPreviousElements("room1");

        expect(elements).toEqual({ elem1: { id: "elem1", type: "rectangle" } });
      });

      it("returns empty object for non-existent conversation", async () => {
        const elements = await manager.getPreviousElements("nonExistent");
        expect(elements).toEqual({});
      });
    });

    describe("setPreviousElements", () => {
      it("updates previous elements in conversation", async () => {
        await manager.initializeConversation(
          "room1",
          "problem1",
          "Test statement"
        );

        await manager.setPreviousElements("room1", {
          elem1: { id: "elem1", type: "ellipse" },
        });

        const elements = await manager.getPreviousElements("room1");
        expect(elements.elem1.type).toBe("ellipse");
      });

      it("throws error for non-existent conversation", async () => {
        await expect(
          manager.setPreviousElements("nonExistent", {})
        ).rejects.toThrow("No conversation state for room: nonExistent");
      });
    });

    describe("setCurrentProblemStatement", () => {
      it("updates current problem statement in conversation", async () => {
        await manager.initializeConversation(
          "room1",
          "problem1",
          "Test statement"
        );

        await manager.setCurrentProblemStatement("room1", "Updated problem");

        const state = await manager.getConversation("room1");
        expect(state?.currentProblemStatement).toBe("Updated problem");
      });

      it("throws error for non-existent conversation", async () => {
        await expect(
          manager.setCurrentProblemStatement("nonExistent", "Test")
        ).rejects.toThrow("No conversation state for room: nonExistent");
      });
    });

    describe("clearConversation", () => {
      it("removes conversation state", async () => {
        await manager.initializeConversation(
          "room1",
          "problem1",
          "Test statement"
        );

        await manager.clearConversation("room1");

        const state = await manager.getConversation("room1");
        expect(state).toBeUndefined();
      });
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest room when max is exceeded", async () => {
      const smallManager = new MultiRoomStateManager(2);

      await smallManager.setElement("e1", createTestElement("e1"), "room1");
      await smallManager.setElement("e2", createTestElement("e2"), "room2");
      await smallManager.setElement("e3", createTestElement("e3"), "room3");

      // room1 should have been evicted
      const count = await smallManager.getRoomCount();
      expect(count).toBe(2);
    });
  });
});
