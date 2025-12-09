import { useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';

/**
 * Element type from Excalidraw (simplified for Yjs storage)
 */
interface ExcalidrawElement {
  id: string;
  type: string;
  isDeleted?: boolean;
  [key: string]: unknown;
}

interface UseYjsElementsOptions {
  /**
   * Throttle sync updates to reduce network overhead.
   * Set to 0 for real-time sync (default: 100ms).
   * Higher values = fewer updates, chunkier remote experience.
   */
  throttleMs?: number;
}

interface UseYjsElementsResult {
  /**
   * Called when Excalidraw scene changes locally.
   * Updates Y.Array with the new elements.
   */
  onExcalidrawChange: (elements: readonly ExcalidrawElement[]) => void;
}

/**
 * Hook to sync Excalidraw elements with a Yjs Y.Array.
 *
 * @param yElements - Y.Array to store elements
 * @param onRemoteChange - Called when Y.Array changes from remote updates
 * @param options - Configuration options including throttleMs
 */
export function useYjsElements(
  yElements: Y.Array<unknown> | null,
  onRemoteChange: (elements: ExcalidrawElement[]) => void,
  options: UseYjsElementsOptions = {}
): UseYjsElementsResult {
  const { throttleMs = 100 } = options;
  // Track if we're currently applying changes to prevent loops
  const isApplyingRef = useRef(false);
  // Track the last known elements to diff
  const lastElementsRef = useRef<Map<string, ExcalidrawElement>>(new Map());
  // For throttling: store pending elements and timer
  const pendingElementsRef = useRef<readonly ExcalidrawElement[] | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for remote Y.Array changes
  useEffect(() => {
    if (!yElements) return;

    const observer = (event: Y.YArrayEvent<unknown>) => {
      // Ignore changes we made ourselves
      if (event.transaction.origin === 'local') return;

      // Get current elements from Y.Array
      const elements = yElements.toArray() as ExcalidrawElement[];

      // Update lastElementsRef BEFORE calling onRemoteChange
      // This prevents duplication when Excalidraw fires onChange after receiving remote updates
      lastElementsRef.current = new Map(
        elements.map((el) => [el.id, JSON.parse(JSON.stringify(el))])
      );

      // Filter out deleted elements and call the callback
      const activeElements = elements.filter((el) => !el.isDeleted);
      onRemoteChange(activeElements);
    };

    yElements.observe(observer);

    // Initial sync - load existing elements from Y.Array
    const initialElements = yElements.toArray() as ExcalidrawElement[];
    if (initialElements.length > 0) {
      const activeElements = initialElements.filter((el) => !el.isDeleted);
      onRemoteChange(activeElements);

      // Update lastElementsRef with deep copies
      lastElementsRef.current = new Map(
        initialElements.map((el) => [el.id, JSON.parse(JSON.stringify(el))])
      );
    }

    return () => {
      yElements.unobserve(observer);
    };
  }, [yElements, onRemoteChange]);

  // Core sync function - applies elements to Y.Array
  const syncToYArray = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      if (!yElements || isApplyingRef.current) return;

      const doc = yElements.doc;
      if (!doc) return;

      isApplyingRef.current = true;

      try {
        doc.transact(() => {
          // Build a map of current elements
          const currentMap = new Map(elements.map((el) => [el.id, el]));
          const storedMap = lastElementsRef.current;

          // Find elements to add, update, or mark as deleted
          const toAdd: ExcalidrawElement[] = [];
          const toUpdate: Array<{ index: number; element: ExcalidrawElement }> = [];
          const storedArray = yElements.toArray() as ExcalidrawElement[];
          const storedIndexMap = new Map(
            storedArray.map((el, i) => [el.id, i])
          );

          // Check for new or updated elements
          for (const element of elements) {
            const stored = storedMap.get(element.id);
            if (!stored) {
              // New element
              toAdd.push({ ...element });
            } else if (JSON.stringify(stored) !== JSON.stringify(element)) {
              // Updated element
              const index = storedIndexMap.get(element.id);
              if (index !== undefined) {
                toUpdate.push({ index, element: { ...element } });
              }
            }
          }

          // Check for deleted elements
          for (const [id, stored] of storedMap) {
            if (!currentMap.has(id) && !stored.isDeleted) {
              const index = storedIndexMap.get(id);
              if (index !== undefined) {
                toUpdate.push({
                  index,
                  element: { ...stored, isDeleted: true },
                });
              }
            }
          }

          // Apply updates (in reverse order to maintain indices)
          toUpdate.sort((a, b) => b.index - a.index);
          for (const { index, element } of toUpdate) {
            yElements.delete(index, 1);
            yElements.insert(index, [element]);
          }

          // Add new elements
          if (toAdd.length > 0) {
            yElements.push(toAdd);
          }

          // Update lastElementsRef with deep copies to ensure accurate change detection
          lastElementsRef.current = new Map(
            elements.map((el) => [el.id, JSON.parse(JSON.stringify(el))])
          );
        }, 'local');
      } finally {
        isApplyingRef.current = false;
      }
    },
    [yElements]
  );

  // Handle local Excalidraw changes with throttling
  const onExcalidrawChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      // No throttling - sync immediately
      if (throttleMs <= 0) {
        syncToYArray(elements);
        return;
      }

      // Store the latest elements (always keep most recent)
      pendingElementsRef.current = elements;

      // If no timer is running, start one
      if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = null;
          if (pendingElementsRef.current) {
            syncToYArray(pendingElementsRef.current);
            pendingElementsRef.current = null;
          }
        }, throttleMs);
      }
    },
    [syncToYArray, throttleMs]
  );

  // Cleanup: flush pending sync on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      // Flush any pending elements
      if (pendingElementsRef.current && yElements) {
        syncToYArray(pendingElementsRef.current);
        pendingElementsRef.current = null;
      }
    };
  }, [syncToYArray, yElements]);

  return { onExcalidrawChange };
}
