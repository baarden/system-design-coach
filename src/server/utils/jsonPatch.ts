import jsonpatch from "fast-json-patch";
import type { Operation } from "fast-json-patch";
import type { SimplifiedElement, ElementsObject } from "../types/conversation.js";

/**
 * Converts an array of SimplifiedElements to an object keyed by element ID.
 * This format allows unambiguous JSON Patch operations.
 */
export function elementsArrayToObject(
  elements: SimplifiedElement[]
): ElementsObject {
  const obj: ElementsObject = {};
  for (const el of elements) {
    obj[el.id] = el;
  }
  return obj;
}

/**
 * Generates a JSON Patch (RFC 6902) representing the diff between
 * previous and current element states.
 */
export function generateElementsPatch(
  previousElements: ElementsObject,
  currentElements: ElementsObject
): Operation[] {
  return jsonpatch.compare(previousElements, currentElements);
}
