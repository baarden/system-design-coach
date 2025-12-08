import { describe, it, expect } from "vitest";
import { elementsArrayToObject, generateElementsPatch } from "./jsonPatch.js";
import type { SimplifiedElement } from "../types/conversation.js";

describe("jsonPatch", () => {
  describe("elementsArrayToObject", () => {
    it("converts array of elements to object keyed by id", () => {
      const elements: SimplifiedElement[] = [
        { id: "elem1", type: "rectangle", label: "Database" },
        { id: "elem2", type: "ellipse", label: "Server" },
      ];

      const result = elementsArrayToObject(elements);

      expect(result).toEqual({
        elem1: { id: "elem1", type: "rectangle", label: "Database" },
        elem2: { id: "elem2", type: "ellipse", label: "Server" },
      });
    });

    it("returns empty object for empty array", () => {
      const result = elementsArrayToObject([]);
      expect(result).toEqual({});
    });

    it("handles elements with connections", () => {
      const elements: SimplifiedElement[] = [
        {
          id: "elem1",
          type: "rectangle",
          connections_to: [{ target_id: "elem2", target_label: "Server" }],
        },
      ];

      const result = elementsArrayToObject(elements);

      expect(result.elem1.connections_to).toEqual([
        { target_id: "elem2", target_label: "Server" },
      ]);
    });

    it("overwrites duplicate ids (last wins)", () => {
      const elements: SimplifiedElement[] = [
        { id: "elem1", type: "rectangle", label: "First" },
        { id: "elem1", type: "ellipse", label: "Second" },
      ];

      const result = elementsArrayToObject(elements);

      expect(result.elem1.label).toBe("Second");
      expect(result.elem1.type).toBe("ellipse");
    });
  });

  describe("generateElementsPatch", () => {
    it("generates add operation for new elements", () => {
      const previous = {};
      const current = {
        elem1: { id: "elem1", type: "rectangle" },
      };

      const patch = generateElementsPatch(previous, current);

      expect(patch).toContainEqual({
        op: "add",
        path: "/elem1",
        value: { id: "elem1", type: "rectangle" },
      });
    });

    it("generates remove operation for deleted elements", () => {
      const previous = {
        elem1: { id: "elem1", type: "rectangle" },
      };
      const current = {};

      const patch = generateElementsPatch(previous, current);

      expect(patch).toContainEqual({
        op: "remove",
        path: "/elem1",
      });
    });

    it("generates replace operation for modified elements", () => {
      const previous = {
        elem1: { id: "elem1", type: "rectangle", label: "Old" },
      };
      const current = {
        elem1: { id: "elem1", type: "rectangle", label: "New" },
      };

      const patch = generateElementsPatch(previous, current);

      expect(patch).toContainEqual({
        op: "replace",
        path: "/elem1/label",
        value: "New",
      });
    });

    it("returns empty array when no changes", () => {
      const elements = {
        elem1: { id: "elem1", type: "rectangle" },
      };

      const patch = generateElementsPatch(elements, elements);

      expect(patch).toEqual([]);
    });

    it("handles multiple changes", () => {
      const previous = {
        elem1: { id: "elem1", type: "rectangle" },
        elem2: { id: "elem2", type: "ellipse" },
      };
      const current = {
        elem2: { id: "elem2", type: "ellipse", label: "Modified" },
        elem3: { id: "elem3", type: "diamond" },
      };

      const patch = generateElementsPatch(previous, current);

      expect(patch.length).toBe(3); // remove elem1, add label to elem2, add elem3
    });
  });
});
