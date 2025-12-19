import React, { useState, useCallback, useEffect, useRef, RefObject } from "react";

interface UseDragResizeOptions {
  containerRef: RefObject<HTMLDivElement>;
  /**
   * Optional ref to the target element to resize directly during drag.
   * When provided, the element's style.height is updated directly (bypassing React)
   * for smoother performance. The React state is only updated when drag ends.
   */
  targetRef?: RefObject<HTMLElement>;
  initialHeight?: number;
  minHeight?: number;
  maxHeightRatio?: number;
  /**
   * Direction of resize calculation:
   * - 'fromTop': Height increases as mouse moves down (e.g., feedback panel)
   * - 'fromBottom': Height increases as mouse moves up (e.g., comments panel)
   */
  direction: "fromTop" | "fromBottom";
}

interface UseDragResizeReturn {
  height: number;
  isDragging: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleTouchStart: (e: React.TouchEvent) => void;
}

export function useDragResize({
  containerRef,
  targetRef,
  initialHeight = 120,
  minHeight = 80,
  maxHeightRatio = 0.4,
  direction,
}: UseDragResizeOptions): UseDragResizeReturn {
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number | null>(null);
  // Track the current height during drag (for syncing to state on drag end)
  const currentHeightRef = useRef(initialHeight);
  // Track starting position for relative movement calculation
  const startYRef = useRef(0);
  const startHeightRef = useRef(initialHeight);

  const startDrag = useCallback(
    (clientY: number) => {
      startYRef.current = clientY;
      startHeightRef.current = currentHeightRef.current;
      setIsDragging(true);
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      startDrag(e.clientY);
    },
    [startDrag]
  );

  const calculateHeight = useCallback(
    (clientY: number): number | null => {
      if (!containerRef.current) return null;

      const containerRect = containerRef.current.getBoundingClientRect();
      const maxHeight = containerRect.height * maxHeightRatio;

      // Calculate relative movement from drag start
      const deltaY = clientY - startYRef.current;

      // Apply delta based on direction
      let newHeight: number;
      if (direction === "fromTop") {
        // Moving down increases height
        newHeight = startHeightRef.current + deltaY;
      } else {
        // Moving up increases height (so negate delta)
        newHeight = startHeightRef.current - deltaY;
      }

      return Math.max(minHeight, Math.min(maxHeight, newHeight));
    },
    [containerRef, direction, minHeight, maxHeightRatio]
  );

  const handleMove = useCallback(
    (clientY: number) => {
      // Cancel any pending frame
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      // Schedule update for next frame
      rafRef.current = requestAnimationFrame(() => {
        const newHeight = calculateHeight(clientY);
        if (newHeight === null) return;

        currentHeightRef.current = newHeight;

        // If targetRef is provided, update DOM directly (bypassing React)
        if (targetRef?.current) {
          targetRef.current.style.height = `${newHeight}px`;
        } else {
          // Fall back to React state updates
          setHeight(newHeight);
        }

        rafRef.current = null;
      });
    },
    [calculateHeight, targetRef]
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
    // When using direct DOM manipulation, sync final height to React state
    if (targetRef?.current) {
      setHeight(currentHeightRef.current);
    }
    setIsDragging(false);
  }, [targetRef]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      startDrag(e.touches[0].clientY);
    },
    [startDrag]
  );

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

  // Cleanup pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return { height, isDragging, handleMouseDown, handleTouchStart };
}
