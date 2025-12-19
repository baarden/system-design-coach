import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  // Helper to create a mock React mouse event
  const createMockMouseEvent = (clientY: number) =>
    ({ clientY } as React.MouseEvent);

  // Helper to create a mock React touch event
  const createMockTouchEvent = (clientY: number) =>
    ({ touches: [{ clientY }] } as unknown as React.TouchEvent);

  // Mock requestAnimationFrame to execute callback synchronously
  let rafCallback: FrameRequestCallback | null = null;
  const mockRaf = vi.fn((cb: FrameRequestCallback) => {
    rafCallback = cb;
    return 1;
  });
  const mockCancelRaf = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallback = null;
    vi.stubGlobal("requestAnimationFrame", mockRaf);
    vi.stubGlobal("cancelAnimationFrame", mockCancelRaf);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Helper to flush the RAF callback
  const flushRaf = () => {
    if (rafCallback) {
      rafCallback(performance.now());
      rafCallback = null;
    }
  };

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
      result.current.handleMouseDown(createMockMouseEvent(200));
    });

    expect(result.current.isDragging).toBe(true);
  });

  it("calculates height fromTop correctly using relative movement", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
        initialHeight: 100,
        minHeight: 50,
      })
    );

    // Start dragging at y=200
    act(() => {
      result.current.handleMouseDown(createMockMouseEvent(200));
    });

    // Move mouse down by 50px to y=250
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", { clientY: 250 });
      document.dispatchEvent(mouseEvent);
      flushRaf();
    });

    // Height should increase by 50px: 100 + 50 = 150
    expect(result.current.height).toBe(150);
  });

  it("calculates height fromBottom correctly using relative movement", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromBottom",
        initialHeight: 100,
        minHeight: 50,
      })
    );

    // Start dragging at y=400
    act(() => {
      result.current.handleMouseDown(createMockMouseEvent(400));
    });

    // Move mouse up by 50px to y=350
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", { clientY: 350 });
      document.dispatchEvent(mouseEvent);
      flushRaf();
    });

    // Height should increase by 50px: 100 + 50 = 150
    expect(result.current.height).toBe(150);
  });

  it("respects minHeight constraint", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
        initialHeight: 100,
        minHeight: 80,
      })
    );

    act(() => {
      result.current.handleMouseDown(createMockMouseEvent(200));
    });

    // Try to drag up by 50px (would result in height of 50, below minHeight)
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", { clientY: 150 });
      document.dispatchEvent(mouseEvent);
      flushRaf();
    });

    expect(result.current.height).toBe(80); // Should be clamped to minHeight
  });

  it("respects maxHeightRatio constraint", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
        initialHeight: 100,
        maxHeightRatio: 0.4, // Max 160px (400 * 0.4)
      })
    );

    act(() => {
      result.current.handleMouseDown(createMockMouseEvent(200));
    });

    // Try to drag down by 100px (would result in height of 200, above maxHeight)
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", { clientY: 300 });
      document.dispatchEvent(mouseEvent);
      flushRaf();
    });

    expect(result.current.height).toBe(160); // Should be clamped to maxHeight
  });

  it("handles touch events for drag start", () => {
    const containerRef = createMockContainerRef();

    const { result } = renderHook(() =>
      useDragResize({
        containerRef,
        direction: "fromTop",
        initialHeight: 100,
        minHeight: 50,
      })
    );

    // Start dragging with touch at y=200
    act(() => {
      result.current.handleTouchStart(createMockTouchEvent(200));
    });

    expect(result.current.isDragging).toBe(true);

    // Move touch down by 30px
    act(() => {
      const touchEvent = new TouchEvent("touchmove", {
        touches: [{ clientY: 230 } as Touch],
      });
      document.dispatchEvent(touchEvent);
      flushRaf();
    });

    // Height should increase by 30px: 100 + 30 = 130
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
      result.current.handleMouseDown(createMockMouseEvent(200));
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
      const mouseEvent = new MouseEvent("mousemove", { clientY: 300 });
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
      result.current.handleMouseDown(createMockMouseEvent(200));
    });

    // Should not throw when moving mouse with null ref
    act(() => {
      const mouseEvent = new MouseEvent("mousemove", { clientY: 300 });
      document.dispatchEvent(mouseEvent);
    });

    expect(result.current.height).toBe(120); // Should stay at initial
  });
});
