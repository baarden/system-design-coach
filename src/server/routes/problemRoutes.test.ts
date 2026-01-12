import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import { createProblemRoutes } from "./problemRoutes.js";
import type { AsyncStateManager } from "../managers/types.js";

describe("problemRoutes", () => {
  let app: Express;
  let mockStateManager: AsyncStateManager;

  beforeEach(() => {
    // Create mock state manager
    mockStateManager = {
      getConversation: vi.fn(),
      initializeConversation: vi.fn(),
      addMessage: vi.fn(),
      getPreviousElements: vi.fn(),
      setPreviousElements: vi.fn(),
      setCurrentProblemStatement: vi.fn(),
      clearConversation: vi.fn(),
      getElements: vi.fn(),
      setElements: vi.fn(),
      deleteRoom: vi.fn(),
      getRoomCount: vi.fn(),
      getElementCount: vi.fn(),
    } as unknown as AsyncStateManager;

    app = express();
    app.use(express.json());
    app.use("/api/problems", createProblemRoutes({ stateManager: mockStateManager }));
  });

  describe("GET /api/problems/", () => {
    it("returns list of problems", async () => {
      const res = await request(app).get("/api/problems/");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.problems)).toBe(true);
      expect(res.body.problems.length).toBeGreaterThan(0);
    });

    it("includes required fields in problem list", async () => {
      const res = await request(app).get("/api/problems/");

      const problem = res.body.problems[0];
      expect(problem).toHaveProperty("id");
      expect(problem).toHaveProperty("title");
      expect(problem).toHaveProperty("category");
      expect(problem).toHaveProperty("description");
    });

    it("excludes statement from problem list", async () => {
      const res = await request(app).get("/api/problems/");

      const problem = res.body.problems[0];
      expect(problem).not.toHaveProperty("statement");
    });
  });

  describe("GET /api/problems/:problemId", () => {
    it("returns specific problem with statement", async () => {
      // First get the list to find a valid problem ID
      const listRes = await request(app).get("/api/problems/");
      const problemId = listRes.body.problems[0].id;

      const res = await request(app).get(`/api/problems/${problemId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.problem.id).toBe(problemId);
      expect(res.body.problem).toHaveProperty("statement");
      expect(res.body.problem.statement.length).toBeGreaterThan(0);
    });

    it("returns 404 for non-existent problem", async () => {
      const res = await request(app).get("/api/problems/non-existent-problem-id");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("not found");
    });

    it("includes all problem fields", async () => {
      const listRes = await request(app).get("/api/problems/");
      const problemId = listRes.body.problems[0].id;

      const res = await request(app).get(`/api/problems/${problemId}`);

      expect(res.body.problem).toHaveProperty("id");
      expect(res.body.problem).toHaveProperty("title");
      expect(res.body.problem).toHaveProperty("category");
      expect(res.body.problem).toHaveProperty("description");
      expect(res.body.problem).toHaveProperty("statement");
    });
  });
});
