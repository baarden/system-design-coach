import { describe, it, expect, afterEach } from "vitest";
import { fetchProblems, fetchProblem, fetchHealth, getServerUrl } from "./client";
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";

describe("API Client", () => {
  describe("getServerUrl", () => {
    const originalEnv = import.meta.env.VITE_SERVER_URL;

    afterEach(() => {
      // Restore original env
      if (originalEnv !== undefined) {
        import.meta.env.VITE_SERVER_URL = originalEnv;
      } else {
        delete import.meta.env.VITE_SERVER_URL;
      }
    });

    it("returns empty string (same-origin) when env var is not set", () => {
      delete import.meta.env.VITE_SERVER_URL;
      expect(getServerUrl()).toBe("");
    });

    it("returns env var URL when set", () => {
      import.meta.env.VITE_SERVER_URL = "http://custom-server:8080";
      expect(getServerUrl()).toBe("http://custom-server:8080");
    });
  });

  describe("fetchProblems", () => {
    it("returns problems list on success", async () => {
      const result = await fetchProblems();

      expect(result.success).toBe(true);
      expect(result.problems).toBeDefined();
      expect(result.problems!.length).toBeGreaterThan(0);
      expect(result.problems![0]).toHaveProperty("id");
      expect(result.problems![0]).toHaveProperty("title");
      expect(result.problems![0]).toHaveProperty("category");
    });

    it("handles network errors gracefully", async () => {
      server.use(
        http.get("*/api/problems", () => {
          return HttpResponse.error();
        })
      );

      await expect(fetchProblems()).rejects.toThrow();
    });

    it("handles server error responses", async () => {
      server.use(
        http.get("*/api/problems", () => {
          return HttpResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        })
      );

      const result = await fetchProblems();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Internal server error");
    });
  });

  describe("fetchProblem", () => {
    it("returns problem with statement on success", async () => {
      const result = await fetchProblem("url-shortener");

      expect(result.success).toBe(true);
      expect(result.problem).toBeDefined();
      expect(result.problem!.id).toBe("url-shortener");
      expect(result.problem!.statement).toBeDefined();
      expect(result.problem!.statement.length).toBeGreaterThan(0);
    });

    it("returns error for non-existent problem", async () => {
      const result = await fetchProblem("non-existent-problem");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Problem not found");
    });

    it("handles network errors gracefully", async () => {
      server.use(
        http.get("*/api/problems/:problemId", () => {
          return HttpResponse.error();
        })
      );

      await expect(fetchProblem("url-shortener")).rejects.toThrow();
    });
  });

  describe("fetchHealth", () => {
    it("returns health status", async () => {
      const result = await fetchHealth();

      expect(result.status).toBe("ok");
      expect(result).toHaveProperty("roomCount");
      expect(result).toHaveProperty("clientCount");
      expect(result.redis).toHaveProperty("enabled");
      expect(result.redis).toHaveProperty("connected");
    });

    it("handles network errors gracefully", async () => {
      server.use(
        http.get("*/api/health", () => {
          return HttpResponse.error();
        })
      );

      await expect(fetchHealth()).rejects.toThrow();
    });
  });
});
