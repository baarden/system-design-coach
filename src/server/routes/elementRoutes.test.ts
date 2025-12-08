import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import { createElementRoutes } from "./elementRoutes.js";
import { MultiRoomStateManager } from "../managers/MultiRoomStateManager.js";
import { MultiRoomClientManager } from "../managers/MultiRoomClientManager.js";

describe("elementRoutes", () => {
  let app: Express;
  let stateManager: MultiRoomStateManager;
  let clientManager: MultiRoomClientManager;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    stateManager = new MultiRoomStateManager();
    clientManager = new MultiRoomClientManager();

    app.use(createElementRoutes({ stateManager, clientManager }));
  });

  describe("GET /api/elements/:roomId", () => {
    it("returns empty array for new room", async () => {
      const res = await request(app).get("/api/elements/user123/problem1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.elements).toEqual([]);
      expect(res.body.count).toBe(0);
      expect(res.body.roomId).toBe("user123/problem1");
    });

    it("returns elements for existing room", async () => {
      const element = {
        id: "elem1",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
      await stateManager.setElement("elem1", element as any, "user123/problem1");

      const res = await request(app).get("/api/elements/user123/problem1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.elements).toHaveLength(1);
      expect(res.body.elements[0].id).toBe("elem1");
    });

    it("strips index property from elements", async () => {
      const element = {
        id: "elem1",
        type: "rectangle",
        index: "a0",
        x: 0,
        y: 0,
      };
      await stateManager.setElement("elem1", element as any, "room1");

      const res = await request(app).get("/api/elements/room1");

      expect(res.body.elements[0]).not.toHaveProperty("index");
    });

    it("handles room with slash in path", async () => {
      await stateManager.setElement(
        "elem1",
        { id: "elem1" } as any,
        "user/with/slashes/problem"
      );

      const res = await request(app).get("/api/elements/user/with/slashes/problem");

      expect(res.status).toBe(200);
      expect(res.body.roomId).toBe("user/with/slashes/problem");
    });
  });

  describe("POST /api/elements/sync/:roomId", () => {
    it("syncs elements to room", async () => {
      const elements = [
        { id: "elem1", type: "rectangle", x: 0, y: 0 },
        { id: "elem2", type: "ellipse", x: 50, y: 50 },
      ];

      const res = await request(app)
        .post("/api/elements/sync/user123/problem1")
        .send({ elements, timestamp: Date.now() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.afterCount).toBe(2);
    });

    it("clears existing elements before sync", async () => {
      // Pre-populate room
      await stateManager.setElement(
        "old1",
        { id: "old1" } as any,
        "room1"
      );

      const elements = [{ id: "new1", type: "rectangle" }];
      await request(app)
        .post("/api/elements/sync/room1")
        .send({ elements, timestamp: Date.now() });

      const stored = await stateManager.getElements("room1");
      expect(stored.has("old1")).toBe(false);
      expect(stored.has("new1")).toBe(true);
    });

    it("broadcasts sync event to WebSocket clients", async () => {
      const broadcastSpy = vi.spyOn(clientManager, "broadcast");

      await request(app)
        .post("/api/elements/sync/room1")
        .send({ elements: [{ id: "elem1" }], timestamp: Date.now() });

      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "elements_synced" }),
        "room1"
      );
    });

    it("returns error for missing elements array", async () => {
      const res = await request(app)
        .post("/api/elements/sync/room1")
        .send({ timestamp: Date.now() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("array");
    });

    it("returns error for non-array elements", async () => {
      const res = await request(app)
        .post("/api/elements/sync/room1")
        .send({ elements: "not an array", timestamp: Date.now() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("adds syncedAt and version to elements", async () => {
      const elements = [{ id: "elem1", type: "rectangle" }];
      await request(app)
        .post("/api/elements/sync/room1")
        .send({ elements, timestamp: Date.now() });

      const stored = await stateManager.getElement("elem1", "room1");
      expect(stored?.syncedAt).toBeDefined();
      expect(stored?.version).toBe(1);
    });

    it("includes beforeCount and afterCount in response", async () => {
      await stateManager.setElement("old1", { id: "old1" } as any, "room1");
      await stateManager.setElement("old2", { id: "old2" } as any, "room1");

      const res = await request(app)
        .post("/api/elements/sync/room1")
        .send({
          elements: [{ id: "new1" }, { id: "new2" }, { id: "new3" }],
          timestamp: Date.now(),
        });

      expect(res.body.beforeCount).toBe(2);
      expect(res.body.afterCount).toBe(3);
    });
  });
});
