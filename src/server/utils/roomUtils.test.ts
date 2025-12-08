import { describe, it, expect } from "vitest";
import { parseProblemIdFromRoomId } from "./roomUtils.js";

describe("roomUtils", () => {
  describe("parseProblemIdFromRoomId", () => {
    it("extracts problemId from valid roomId format", () => {
      expect(parseProblemIdFromRoomId("user123/url-shortener")).toBe(
        "url-shortener"
      );
    });

    it("handles roomId with multiple slashes", () => {
      expect(parseProblemIdFromRoomId("user123/problem/extra")).toBe("problem");
    });

    it("returns undefined for roomId without slash", () => {
      expect(parseProblemIdFromRoomId("noslash")).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(parseProblemIdFromRoomId("")).toBeUndefined();
    });

    it("returns empty string when problemId part is empty", () => {
      expect(parseProblemIdFromRoomId("user/")).toBe("");
    });

    it("handles roomId starting with slash", () => {
      expect(parseProblemIdFromRoomId("/problemId")).toBe("problemId");
    });
  });
});
