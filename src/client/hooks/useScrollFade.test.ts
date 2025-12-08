import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollFade } from "./useScrollFade";

describe("useScrollFade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with both scroll flags as false", () => {
    const { result } = renderHook(() => useScrollFade());

    expect(result.current.hasScrollTop).toBe(false);
    expect(result.current.hasScrollBottom).toBe(false);
  });

  it("provides a scrollRef", () => {
    const { result } = renderHook(() => useScrollFade());

    expect(result.current.scrollRef).toBeDefined();
    expect(result.current.scrollRef.current).toBeNull(); // Not attached yet
  });

  it("provides a checkScroll function", () => {
    const { result } = renderHook(() => useScrollFade());

    expect(typeof result.current.checkScroll).toBe("function");
  });

  it("detects scroll position at top (no top fade, has bottom fade)", () => {
    const { result } = renderHook(() => useScrollFade());

    // Mock the scrollRef element
    const mockElement = {
      scrollTop: 0,
      scrollHeight: 500,
      clientHeight: 200,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Manually assign the mock element
    Object.defineProperty(result.current.scrollRef, "current", {
      value: mockElement,
      writable: true,
    });

    act(() => {
      result.current.checkScroll();
    });

    expect(result.current.hasScrollTop).toBe(false);
    expect(result.current.hasScrollBottom).toBe(true);
  });

  it("detects scroll position in middle (both fades visible)", () => {
    const { result } = renderHook(() => useScrollFade());

    const mockElement = {
      scrollTop: 100,
      scrollHeight: 500,
      clientHeight: 200,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(result.current.scrollRef, "current", {
      value: mockElement,
      writable: true,
    });

    act(() => {
      result.current.checkScroll();
    });

    expect(result.current.hasScrollTop).toBe(true);
    expect(result.current.hasScrollBottom).toBe(true);
  });

  it("detects scroll position at bottom (has top fade, no bottom fade)", () => {
    const { result } = renderHook(() => useScrollFade());

    const mockElement = {
      scrollTop: 300, // scrollTop + clientHeight = scrollHeight
      scrollHeight: 500,
      clientHeight: 200,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(result.current.scrollRef, "current", {
      value: mockElement,
      writable: true,
    });

    act(() => {
      result.current.checkScroll();
    });

    expect(result.current.hasScrollTop).toBe(true);
    expect(result.current.hasScrollBottom).toBe(false);
  });

  it("handles content that fits without scrolling (no fades)", () => {
    const { result } = renderHook(() => useScrollFade());

    const mockElement = {
      scrollTop: 0,
      scrollHeight: 200,
      clientHeight: 200, // Content fits exactly
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(result.current.scrollRef, "current", {
      value: mockElement,
      writable: true,
    });

    act(() => {
      result.current.checkScroll();
    });

    expect(result.current.hasScrollTop).toBe(false);
    expect(result.current.hasScrollBottom).toBe(false);
  });

  it("handles near-bottom position with 1px tolerance", () => {
    const { result } = renderHook(() => useScrollFade());

    const mockElement = {
      scrollTop: 299, // 1px away from bottom
      scrollHeight: 500,
      clientHeight: 200,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(result.current.scrollRef, "current", {
      value: mockElement,
      writable: true,
    });

    act(() => {
      result.current.checkScroll();
    });

    expect(result.current.hasScrollTop).toBe(true);
    // scrollTop + clientHeight = 499, scrollHeight - 1 = 499, so no bottom fade
    expect(result.current.hasScrollBottom).toBe(false);
  });

  it("does nothing when scrollRef.current is null", () => {
    const { result } = renderHook(() => useScrollFade());

    // scrollRef.current is null by default
    expect(() => {
      act(() => {
        result.current.checkScroll();
      });
    }).not.toThrow();

    expect(result.current.hasScrollTop).toBe(false);
    expect(result.current.hasScrollBottom).toBe(false);
  });
});
