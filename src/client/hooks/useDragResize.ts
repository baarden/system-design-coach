import { useState, useCallback, useEffect, RefObject } from "react";

interface UseDragResizeOptions {
  containerRef: RefObject<HTMLDivElement>;
  initialHeight?: number;
  minHeight?: number;
  maxHeightRatio?: number;
  /**
   * Direction of resize calculation:
   * - 'fromTop': Height increases as mouse moves down (e.g., feedback panel)
   * - 'fromBottom': Height increases as mouse moves up (e.g., comments panel)
   */
  direction: "fromTop" | "fromBottom";
  /**
   * Offset to account for other elements (padding, buttons, other panels)
   */
  offset?: number;
}

interface UseDragResizeReturn {
  height: number;
  isDragging: boolean;
  handleMouseDown: () => void;
  handleTouchStart: () => void;
}

export function useDragResize({
  containerRef,
  initialHeight = 120,
  minHeight = 80,
  maxHeightRatio = 0.4,
  direction,
  offset = 0,
}: UseDragResizeOptions): UseDragResizeReturn {
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMove = useCallback(
    (clientY: number) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const maxHeight = containerRect.height * maxHeightRatio;

      let newHeight: number;
      if (direction === "fromTop") {
        newHeight = clientY - containerRect.top - offset;
      } else {
        newHeight = containerRect.bottom - clientY - offset;
      }

      setHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
    },
    [containerRef, direction, offset, minHeight, maxHeightRatio]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientY);
    },
    [isDragging, handleMove]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      handleMove(e.touches[0].clientY);
    },
    [isDragging, handleMove]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  return { height, isDragging, handleMouseDown, handleTouchStart };
}
