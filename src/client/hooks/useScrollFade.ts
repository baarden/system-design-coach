import { useState, useCallback, useEffect, useRef, RefObject } from "react";

interface UseScrollFadeReturn {
  scrollRef: RefObject<HTMLDivElement>;
  hasScrollTop: boolean;
  hasScrollBottom: boolean;
  checkScroll: () => void;
}

/**
 * Hook to detect scroll position and show fade effects at top/bottom edges.
 */
export function useScrollFade(): UseScrollFadeReturn {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrollTop, setHasScrollTop] = useState(false);
  const [hasScrollBottom, setHasScrollBottom] = useState(false);

  const checkScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;

    setHasScrollTop(scrollTop > 0);
    setHasScrollBottom(scrollTop + clientHeight < scrollHeight - 1);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    // Check initial scroll state
    checkScroll();

    element.addEventListener("scroll", checkScroll);

    // Re-check when content size changes using ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  return { scrollRef, hasScrollTop, hasScrollBottom, checkScroll };
}
