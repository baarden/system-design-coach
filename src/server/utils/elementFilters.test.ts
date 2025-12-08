import { describe, it, expect } from "vitest";
import { filterElementsForClaude } from "./elementFilters.js";
import type { ServerElement } from "../../shared/types/excalidraw.js";

// Helper to create a minimal ServerElement
function createElement(
  overrides: Partial<ServerElement> & { id: string; type: string }
): ServerElement {
  return {
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
    ...overrides,
  } as ServerElement;
}

describe("elementFilters", () => {
  describe("filterElementsForClaude", () => {
    it("returns simplified elements with id and type", () => {
      const elements = [createElement({ id: "rect1", type: "rectangle" })];

      const result = filterElementsForClaude(elements);

      expect(result).toEqual([{ id: "rect1", type: "rectangle" }]);
    });

    it("filters out text elements", () => {
      const elements = [
        createElement({ id: "rect1", type: "rectangle" }),
        createElement({ id: "text1", type: "text", text: "Hello" } as any),
      ];

      const result = filterElementsForClaude(elements);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("rect1");
    });

    it("filters out arrow elements", () => {
      const elements = [
        createElement({ id: "rect1", type: "rectangle" }),
        createElement({ id: "arrow1", type: "arrow" }),
      ];

      const result = filterElementsForClaude(elements);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("rect1");
    });

    it("extracts label from bound text element", () => {
      const elements = [
        createElement({
          id: "rect1",
          type: "rectangle",
          boundElements: [{ type: "text", id: "text1" }],
        } as any),
        createElement({ id: "text1", type: "text", text: "Database" } as any),
      ];

      const result = filterElementsForClaude(elements);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Database");
    });

    it("includes frameId when present", () => {
      const elements = [
        createElement({ id: "rect1", type: "rectangle", frameId: "frame1" }),
      ];

      const result = filterElementsForClaude(elements);

      expect(result[0].frameId).toBe("frame1");
    });

    it("uses frame name as label for frame elements", () => {
      const elements = [
        createElement({ id: "frame1", type: "frame", name: "Backend" } as any),
      ];

      const result = filterElementsForClaude(elements);

      expect(result[0].label).toBe("Backend");
    });

    it("builds connections from arrows", () => {
      const elements = [
        createElement({
          id: "rect1",
          type: "rectangle",
          boundElements: [{ type: "arrow", id: "arrow1" }],
        } as any),
        createElement({
          id: "rect2",
          type: "rectangle",
          boundElements: [{ type: "arrow", id: "arrow1" }],
        } as any),
        createElement({
          id: "arrow1",
          type: "arrow",
          startBinding: { elementId: "rect1" },
          endBinding: { elementId: "rect2" },
          endArrowhead: "arrow",
        } as any),
      ];

      const result = filterElementsForClaude(elements);

      const rect1 = result.find((e) => e.id === "rect1");
      expect(rect1?.connections_to).toEqual([{ target_id: "rect2" }]);
    });

    it("adds bidirectional connections for arrows without arrowheads", () => {
      const elements = [
        createElement({ id: "rect1", type: "rectangle" }),
        createElement({ id: "rect2", type: "rectangle" }),
        createElement({
          id: "arrow1",
          type: "arrow",
          startBinding: { elementId: "rect1" },
          endBinding: { elementId: "rect2" },
          startArrowhead: null,
          endArrowhead: null,
        } as any),
      ];

      const result = filterElementsForClaude(elements);

      const rect1 = result.find((e) => e.id === "rect1");
      const rect2 = result.find((e) => e.id === "rect2");
      expect(rect1?.connections_to).toContainEqual({ target_id: "rect2" });
      expect(rect2?.connections_to).toContainEqual({ target_id: "rect1" });
    });

    it("includes arrow label in connection", () => {
      const elements = [
        createElement({ id: "rect1", type: "rectangle" }),
        createElement({ id: "rect2", type: "rectangle" }),
        createElement({
          id: "arrow1",
          type: "arrow",
          startBinding: { elementId: "rect1" },
          endBinding: { elementId: "rect2" },
          endArrowhead: "arrow",
          boundElements: [{ type: "text", id: "arrowText" }],
        } as any),
        createElement({
          id: "arrowText",
          type: "text",
          text: "HTTP Request",
        } as any),
      ];

      const result = filterElementsForClaude(elements);

      const rect1 = result.find((e) => e.id === "rect1");
      expect(rect1?.connections_to?.[0].arrow_label).toBe("HTTP Request");
    });

    it("includes target label in connection", () => {
      const elements = [
        createElement({ id: "rect1", type: "rectangle" }),
        createElement({
          id: "rect2",
          type: "rectangle",
          boundElements: [{ type: "text", id: "text2" }],
        } as any),
        createElement({ id: "text2", type: "text", text: "Server" } as any),
        createElement({
          id: "arrow1",
          type: "arrow",
          startBinding: { elementId: "rect1" },
          endBinding: { elementId: "rect2" },
          endArrowhead: "arrow",
        } as any),
      ];

      const result = filterElementsForClaude(elements);

      const rect1 = result.find((e) => e.id === "rect1");
      expect(rect1?.connections_to?.[0].target_label).toBe("Server");
    });

    it("handles empty elements array", () => {
      const result = filterElementsForClaude([]);
      expect(result).toEqual([]);
    });

    it("skips elements without id", () => {
      const elements = [
        createElement({ id: "", type: "rectangle" }),
        createElement({ id: "rect1", type: "rectangle" }),
      ];

      const result = filterElementsForClaude(elements);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("rect1");
    });

    it("handles arrows with missing bindings", () => {
      const elements = [
        createElement({ id: "rect1", type: "rectangle" }),
        createElement({
          id: "arrow1",
          type: "arrow",
          startBinding: { elementId: "rect1" },
          endBinding: null,
        } as any),
      ];

      const result = filterElementsForClaude(elements);

      const rect1 = result.find((e) => e.id === "rect1");
      expect(rect1?.connections_to).toBeUndefined();
    });
  });
});
