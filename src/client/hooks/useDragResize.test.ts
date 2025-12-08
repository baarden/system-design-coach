import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDragResize } from "./useDragResize";

describe("useDragResize", () => {
  // Mock container element
  const mockContainerRect = {
    top: 100,
    bottom: 500,
    height: 400,
    left: 0,
    right: 800,
    width: 800,
    x: 0,
    y: 100,
    toJSON: () => ({}),
  };

  const createMockContainerRef = () => ({
    current: {
      getBoundingClientRect: () => mockContainerRect,
    } as HTMLDivElement,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default height", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
      })
    );

    expect(result.current.height).toBe(120); // Default initialHeight
    expect(result.current.isDragging).toBe(false);
  });

  it("initializes with custom initial height", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        initialHeight: 200,
        direction: "fromTop",
      })
    );

    expect(result.current.height).toBe(200);
  });

  it("sets isDragging to true on handleMouseDown", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
      })
    );

    act(() => {
      result.current.handleMouseDown();
    });

    expect(result.current.isDragging).toBe(true);
  });

  it("calculates height fromTop correctly during drag", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
        minHeight: 50,
        offset: 0,
      })
    );

    // Start dragging
    act(() => {
      result.current.handleMouseDown();
    });

    // Simulate mouse move to y=250 (150px from top of container)
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", {
        clientY: 250,
      });
      document.dispatchEvent(mouseEvent);
    });

    // Height should be clientY - containerTop - offset = 250 - 100 - 0 = 150
    expect(result.current.height).toBe(150);
  });

  it("calculates height fromBottom correctly during drag", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromBottom",
        minHeight: 50,
        offset: 0,
      })
    );

    // Start dragging
    act(() => {
      result.current.handleMouseDown();
    });

    // Simulate mouse move to y=400 (100px from bottom of container)
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", {
        clientY: 400,
      });
      document.dispatchEvent(mouseEvent);
    });

    // Height should be containerBottom - clientY - offset = 500 - 400 - 0 = 100
    expect(result.current.height).toBe(100);
  });

  it("respects minHeight constraint", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
        minHeight: 80,
      })
    );

    act(() => {
      result.current.handleMouseDown();
    });

    // Try to drag to a very small height
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", {
        clientY: 110, // Would give height of 10px
      });
      document.dispatchEvent(mouseEvent);
    });

    expect(result.current.height).toBe(80); // Should be clamped to minHeight
  });

  it("respects maxHeightRatio constraint", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
        maxHeightRatio: 0.4, // Max 160px (400 * 0.4)
      })
    );

    act(() => {
      result.current.handleMouseDown();
    });

    // Try to drag to a very large height
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", {
        clientY: 400, // Would give height of 300px
      });
      document.dispatchEvent(mouseEvent);
    });

    expect(result.current.height).toBe(160); // Should be clamped to maxHeight
  });

  it("applies offset to height calculation", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
        offset: 20,
        minHeight: 50,
      })
    );

    act(() => {
      result.current.handleMouseDown();
    });

    act(() => {
      const mouseEvent = new MouseEvent("mousemove", {
        clientY: 250,
      });
      document.dispatchEvent(mouseEvent);
    });

    // Height should be 250 - 100 - 20 = 130
    expect(result.current.height).toBe(130);
  });

  it("stops dragging on mouseup", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
      })
    );

    act(() => {
      result.current.handleMouseDown();
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      const mouseEvent = new MouseEvent("mouseup");
      document.dispatchEvent(mouseEvent);
    });

    expect(result.current.isDragging).toBe(false);
  });

  it("does not update height when not dragging", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        initialHeight: 120,
        direction: "fromTop",
      })
    );

    // Don't start dragging, just move mouse
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", {
        clientY: 300,
      });
      document.dispatchEvent(mouseEvent);
    });

    expect(result.current.height).toBe(120); // Should not change
  });

  it("handles null containerRef gracefully", () => {
    const nullRef = { current: null };

    const { result } = renderHook(() =>
      useDragResize({
        containerRef: nullRef,
        direction: "fromTop",
      })
    );

    act(() => {
      result.current.handleMouseDown();
    });

    // Should not throw when moving mouse with null ref
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", {
        clientY: 300,
      });
      document.dispatchEvent(mouseEvent);
    });

    expect(result.current.height).toBe(120); // Should stay at initial
  });
});
