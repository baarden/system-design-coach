import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useYjsElements } from "./useYjsElements";
import * as Y from "yjs";

interface ExcalidrawElement {
  id: string;
  type: string;
  isDeleted?: boolean;
  [key: string]: unknown;
}

describe("useYjsElements", () => {
  let doc: Y.Doc;
  let yElements: Y.Array<unknown>;
  let onRemoteChange: Mock<(elements: ExcalidrawElement[]) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    doc = new Y.Doc();
    yElements = doc.getArray("elements");
    onRemoteChange = vi.fn<(elements: ExcalidrawElement[]) => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
    doc.destroy();
  });

  describe("throttling", () => {
    it("batches rapid changes when throttleMs > 0", () => {
      const { result } = renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 100 })
      );

      // Simulate rapid changes (like dragging)
      act(() => {
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle", x: 0 }]);
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle", x: 10 }]);
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle", x: 20 }]);
      });

      // Before throttle fires, Y.Array should be empty (no sync yet)
      expect(yElements.length).toBe(0);

      // After throttle period, only the final state should be synced
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(yElements.length).toBe(1);
      const element = yElements.get(0) as { id: string; x: number };
      expect(element.x).toBe(20); // Only final position synced
    });

    it("syncs immediately when throttleMs is 0", () => {
      const { result } = renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 0 })
      );

      act(() => {
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle", x: 0 }]);
      });

      // Should sync immediately without waiting
      expect(yElements.length).toBe(1);
    });

    it("uses default throttleMs of 100 when not specified", () => {
      const { result } = renderHook(() =>
        useYjsElements(yElements, onRemoteChange)
      );

      act(() => {
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle" }]);
      });

      // Should not sync immediately (throttled)
      expect(yElements.length).toBe(0);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(yElements.length).toBe(1);
    });

    it("flushes pending updates on unmount", () => {
      const { result, unmount } = renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 100 })
      );

      act(() => {
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle", x: 50 }]);
      });

      // Before throttle fires
      expect(yElements.length).toBe(0);

      // Unmount should flush pending
      act(() => {
        unmount();
      });

      expect(yElements.length).toBe(1);
      const element = yElements.get(0) as { id: string; x: number };
      expect(element.x).toBe(50);
    });

    it("does not create duplicate syncs for same element during throttle window", () => {
      const { result } = renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 100 })
      );

      // Multiple updates to same element
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.onExcalidrawChange([{ id: "1", type: "rectangle", x: i * 10 }]);
        }
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should only have one element, not 10
      expect(yElements.length).toBe(1);
      const element = yElements.get(0) as { id: string; x: number };
      expect(element.x).toBe(90); // Final value
    });
  });

  describe("element sync", () => {
    it("adds new elements to Y.Array", () => {
      const { result } = renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 0 })
      );

      act(() => {
        result.current.onExcalidrawChange([
          { id: "1", type: "rectangle" },
          { id: "2", type: "ellipse" },
        ]);
      });

      expect(yElements.length).toBe(2);
    });

    it("updates existing elements in Y.Array", () => {
      const { result } = renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 0 })
      );

      // Add initial element
      act(() => {
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle", x: 0 }]);
      });

      // Update it
      act(() => {
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle", x: 100 }]);
      });

      expect(yElements.length).toBe(1);
      const element = yElements.get(0) as { id: string; x: number };
      expect(element.x).toBe(100);
    });

    it("marks removed elements as deleted", () => {
      const { result } = renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 0 })
      );

      // Add elements
      act(() => {
        result.current.onExcalidrawChange([
          { id: "1", type: "rectangle" },
          { id: "2", type: "ellipse" },
        ]);
      });

      // Remove one
      act(() => {
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle" }]);
      });

      // Element 2 should be marked as deleted, not removed
      expect(yElements.length).toBe(2);
      const element2 = yElements.get(1) as { id: string; isDeleted?: boolean };
      expect(element2.isDeleted).toBe(true);
    });
  });

  describe("remote changes", () => {
    it("calls onRemoteChange when Y.Array changes from remote", () => {
      renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 0 })
      );

      // Simulate remote change (not from 'local' origin)
      act(() => {
        doc.transact(() => {
          yElements.push([{ id: "remote-1", type: "rectangle" }]);
        }, "remote");
      });

      expect(onRemoteChange).toHaveBeenCalled();
      const elements = onRemoteChange.mock.calls[0][0];
      expect(elements).toHaveLength(1);
      expect(elements[0].id).toBe("remote-1");
    });

    it("filters out deleted elements when calling onRemoteChange", () => {
      renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 0 })
      );

      act(() => {
        doc.transact(() => {
          yElements.push([
            { id: "1", type: "rectangle", isDeleted: false },
            { id: "2", type: "ellipse", isDeleted: true },
          ]);
        }, "remote");
      });

      const elements = onRemoteChange.mock.calls[0][0];
      expect(elements).toHaveLength(1);
      expect(elements[0].id).toBe("1");
    });

    it("ignores local changes in observer", () => {
      const { result } = renderHook(() =>
        useYjsElements(yElements, onRemoteChange, { throttleMs: 0 })
      );

      // Clear any initial calls
      onRemoteChange.mockClear();

      // Local change should not trigger onRemoteChange
      act(() => {
        result.current.onExcalidrawChange([{ id: "1", type: "rectangle" }]);
      });

      expect(onRemoteChange).not.toHaveBeenCalled();
    });
  });
});
