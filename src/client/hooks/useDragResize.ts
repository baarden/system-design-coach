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

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const maxHeight = containerRect.height * maxHeightRatio;

      let newHeight: number;
      if (direction === "fromTop") {
        newHeight = e.clientY - containerRect.top - offset;
      } else {
        newHeight = containerRect.bottom - e.clientY - offset;
      }

      setHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
    },
    [isDragging, containerRef, direction, offset, minHeight, maxHeightRatio]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return { height, isDragging, handleMouseDown };
}
