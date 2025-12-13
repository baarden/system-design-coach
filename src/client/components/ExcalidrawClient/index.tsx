/**
 * ExcalidrawClient - A React component that wraps Excalidraw with WebSocket sync.
 * Thanks to mcp-excalidraw (https://github.com/anthropics/mcp-excalidraw) for the original implementation.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Excalidraw,
  convertToExcalidrawElements,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import type * as Y from "yjs";
import type { ServerElement, ExcalidrawMessage } from "@shared/types/excalidraw";
import { useYjsElements } from "../../hooks/useYjsElements";

// Local type definitions for Excalidraw types that aren't cleanly exported
interface ExcalidrawElement {
  id: string;
  type: string;
  isDeleted?: boolean;
  boundElements?: ReadonlyArray<{ id: string; type: string }> | null;
  containerId?: string | null;
  [key: string]: unknown;
}

export interface ExcalidrawImperativeAPI {
  updateScene: (scene: {
    elements?: readonly ExcalidrawElement[];
    captureUpdate?: typeof CaptureUpdateAction.NEVER;
  }) => void;
  getSceneElements: () => readonly ExcalidrawElement[];
  addFiles: (files: { id: string; mimeType: string; dataURL: string; created: number }[]) => void;
}

interface ApiResponse {
  success: boolean;
  elements?: ServerElement[];
  element?: ServerElement;
  count?: number;
  error?: string;
  message?: string;
}

export interface ExcalidrawClientProps {
  serverUrl?: string;
  roomId?: string;
  /** Custom WebSocket path. If provided, overrides the default /${roomId} path. */
  wsPath?: string;
  theme?: "light" | "dark";
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSync?: (count: number) => void;
  onSyncError?: (error: Error) => void;
  /** Called for all WebSocket messages, allowing parent to observe traffic */
  onMessage?: (message: ExcalidrawMessage) => void;
  /** Called when initial sync is complete. Fires once per connection with the initial elements. */
  onReady?: (
    api: {
      send: (message: unknown) => void;
      syncToBackend: () => Promise<void>;
      excalidrawAPI: ExcalidrawImperativeAPI;
    },
    initialElements: ServerElement[]
  ) => void;
  initialData?: {
    elements?: ExcalidrawElement[];
    appState?: Record<string, unknown>;
  };
  /** Optional Yjs Y.Array for collaborative element sync. When provided, enables real-time collaboration. */
  yElements?: Y.Array<unknown> | null;
  /** Throttle Yjs sync updates in milliseconds. Higher = fewer updates, less real-time. Default: 100ms. Set to 0 for no throttling. */
  yjsThrottleMs?: number;
}

// Helper function to clean elements for Excalidraw
const cleanElementForExcalidraw = (
  element: ServerElement
): Partial<ExcalidrawElement> => {
  const {
    createdAt,
    updatedAt,
    version,
    syncedAt,
    source,
    syncTimestamp,
    ...cleanElement
  } = element;
  return cleanElement as Partial<ExcalidrawElement>;
};

// Helper function to validate and fix element binding data
// existingElements: elements already in the scene (for validating bindings during remote sync)
const validateAndFixBindings = (
  elements: Partial<ExcalidrawElement>[],
  existingElements?: readonly ExcalidrawElement[]
): Partial<ExcalidrawElement>[] => {
  // Build a map of all known elements (incoming + existing)
  const elementMap = new Map(elements.map((el) => [el.id!, el]));
  if (existingElements) {
    for (const el of existingElements) {
      if (!elementMap.has(el.id)) {
        elementMap.set(el.id, el);
      }
    }
  }

  return elements.map((element) => {
    const fixedElement = { ...element };

    // Validate and fix boundElements
    if (fixedElement.boundElements) {
      if (Array.isArray(fixedElement.boundElements)) {
        fixedElement.boundElements = fixedElement.boundElements.filter(
          (binding: { id?: string; type?: string } | null | undefined) => {
            if (!binding || typeof binding !== "object") return false;
            if (!binding.id || !binding.type) return false;
            const referencedElement = elementMap.get(binding.id);
            if (!referencedElement) return false;
            if (!["text", "arrow"].includes(binding.type)) return false;
            return true;
          }
        );

        if (fixedElement.boundElements.length === 0) {
          fixedElement.boundElements = null;
        }
      } else {
        fixedElement.boundElements = null;
      }
    }

    // Validate and fix containerId
    if (fixedElement.containerId) {
      const containerElement = elementMap.get(fixedElement.containerId);
      if (!containerElement) {
        fixedElement.containerId = null;
      }
    }

    return fixedElement;
  });
};

export function ExcalidrawClient(
  props: ExcalidrawClientProps = {}
): JSX.Element {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const mountedRef = useRef(true);
  const readyFiredRef = useRef(false);
  // Track if we're applying remote Yjs changes to avoid loops
  const isApplyingRemoteRef = useRef(false);
  // Track WebSocket activity for stale connection detection (CDN idle timeouts)
  const lastActivityRef = useRef<number>(Date.now());
  const CONNECTION_MAX_IDLE_MS = 20000; // 20 seconds

  excalidrawAPIRef.current = excalidrawAPI;

  // Handle remote Yjs element changes
  const handleRemoteYjsChange = useCallback(
    (elements: ExcalidrawElement[]) => {
      if (!excalidrawAPIRef.current) return;

      isApplyingRemoteRef.current = true;
      try {
        // For Yjs-synced elements, trust the Y.Doc data without stripping bindings.
        // Y.Doc maintains consistency through CRDTs, so bindings should be valid.
        // Only clean server-specific metadata properties.
        const cleanedElements = elements.map((el) =>
          cleanElementForExcalidraw(el as unknown as ServerElement)
        );
        excalidrawAPIRef.current.updateScene({
          elements: cleanedElements as ExcalidrawElement[],
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      } finally {
        // Use setTimeout to ensure the flag is reset after the current event loop
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 0);
      }
    },
    []
  );

  // Use Yjs elements hook for collaborative sync
  const { onExcalidrawChange } = useYjsElements(
    props.yElements ?? null,
    handleRemoteYjsChange,
    { throttleMs: props.yjsThrottleMs }
  );

  // Handle local Excalidraw changes
  const handleExcalidrawChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      // Don't sync if we're applying remote changes (to avoid loops)
      if (isApplyingRemoteRef.current) return;

      // If Yjs is enabled, sync through Yjs
      if (props.yElements) {
        onExcalidrawChange(elements);
      }
    },
    [props.yElements, onExcalidrawChange]
  );

  const baseUrl =
    props.serverUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const roomIdPath = props.roomId ? `/${props.roomId}` : "";
  const wsPath = props.wsPath ?? roomIdPath;

  const send = (message: unknown): void => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;

    // If connection is stale, reconnect before sending
    if (timeSinceActivity > CONNECTION_MAX_IDLE_MS && websocketRef.current) {
      websocketRef.current.close();
      // connectWebSocket will be called by onclose handler, queue the message
      const waitForConnection = (): void => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          lastActivityRef.current = Date.now();
          websocketRef.current.send(JSON.stringify(message));
        } else if (websocketRef.current?.readyState === WebSocket.CONNECTING) {
          setTimeout(waitForConnection, 50);
        }
      };
      setTimeout(waitForConnection, 100);
      return;
    }

    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      lastActivityRef.current = now;
      websocketRef.current.send(JSON.stringify(message));
    }
  };

  const syncToBackend = async (): Promise<void> => {
    if (!excalidrawAPIRef.current) return;

    try {
      const currentElements = excalidrawAPIRef.current.getSceneElements();
      const activeElements = currentElements.filter((el: ExcalidrawElement) => !el.isDeleted);
      const backendElements = activeElements.map(
        (el: ExcalidrawElement) => ({ ...el }) as unknown as ServerElement
      );

      const response = await fetch(`${baseUrl}/api/elements/sync${roomIdPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elements: backendElements,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const result: ApiResponse = await response.json();
        props.onSync?.(result.count || 0);
      } else {
        throw new Error("Sync failed");
      }
    } catch (error) {
      props.onSyncError?.(error as Error);
    }
  };

  const handleWebSocketMessage = async (
    data: ExcalidrawMessage
  ): Promise<void> => {
    // Notify parent of ALL messages
    props.onMessage?.(data);

    if (!excalidrawAPI) return;

    try {
      const currentElements = excalidrawAPI.getSceneElements();

      switch (data.type) {
        case "initial_elements": {
          const elements = (data.elements as ServerElement[]) || [];
          // Skip loading initial_elements if Yjs is enabled - Yjs will sync the authoritative state
          // This prevents stale stateManager data from overwriting Y.Doc state
          if (!props.yElements && elements.length > 0) {
            const cleanedElements = elements.map(cleanElementForExcalidraw);
            const validatedElements = validateAndFixBindings(cleanedElements);
            excalidrawAPI.updateScene({
              elements: validatedElements as ExcalidrawElement[],
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
          // Fire onReady after initial_elements is processed
          if (!readyFiredRef.current) {
            readyFiredRef.current = true;
            props.onReady?.(
              { send, syncToBackend, excalidrawAPI },
              elements
            );
          }
          break;
        }

        case "element_created": {
          const element = data.element as ServerElement;
          if (element) {
            const cleanedNewElement = cleanElementForExcalidraw(element);
            const newElement = convertToExcalidrawElements([cleanedNewElement] as Parameters<typeof convertToExcalidrawElements>[0]);
            excalidrawAPI.updateScene({
              elements: [...currentElements, ...newElement],
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
          break;
        }

        case "element_updated": {
          const element = data.element as ServerElement;
          if (element) {
            const cleanedUpdatedElement = cleanElementForExcalidraw(element);
            const convertedUpdatedElement = convertToExcalidrawElements(
              [cleanedUpdatedElement] as Parameters<typeof convertToExcalidrawElements>[0]
            )[0];
            excalidrawAPI.updateScene({
              elements: currentElements.map((el: ExcalidrawElement) =>
                el.id === element.id ? convertedUpdatedElement : el
              ),
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
          break;
        }

        case "element_deleted": {
          const elementId = data.elementId as string;
          if (elementId) {
            const filteredElements = currentElements.filter(
              (el: ExcalidrawElement) => el.id !== elementId
            );
            excalidrawAPI.updateScene({
              elements: filteredElements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
          break;
        }

        case "elements_batch_created": {
          // Elements can be skeleton format (with label property) or full elements
          const elements = data.elements as Record<string, unknown>[];
          if (elements && elements.length > 0) {
            // Convert skeleton elements to full Excalidraw elements
            // This handles label -> bound text conversion with proper bindings
            // Use regenerateIds: false to preserve IDs set by server
            const convertedElements = convertToExcalidrawElements(
              elements as Parameters<typeof convertToExcalidrawElements>[0],
              { regenerateIds: false }
            );
            excalidrawAPI.updateScene({
              elements: [...currentElements, ...convertedElements],
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
          break;
        }

        case "elements_synced":
        case "sync_status":
          // Handled internally, no action needed
          break;

        default:
          // Unknown message types are already passed to onMessage above
          break;
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error, data);
    }
  };

  const connectWebSocket = (): void => {
    if (
      websocketRef.current &&
      (websocketRef.current.readyState === WebSocket.OPEN ||
        websocketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = baseUrl.startsWith("https") ? "wss:" : "ws:";
    const wsBaseUrl = baseUrl.replace(/^https?:/, protocol);
    const wsUrl = `${wsBaseUrl}${wsPath}`;

    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => {
      lastActivityRef.current = Date.now(); // Fresh connection
      props.onConnect?.();
      // Note: onReady is NOT fired here. It fires after initial_elements arrives.
    };

    websocketRef.current.onmessage = (event: MessageEvent) => {
      lastActivityRef.current = Date.now(); // Track activity
      try {
        const data: ExcalidrawMessage = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error, event.data);
      }
    };

    websocketRef.current.onclose = (event: CloseEvent) => {
      props.onDisconnect?.();
      readyFiredRef.current = false; // Reset so onReady fires again on reconnect

      if (event.code !== 1000 && mountedRef.current) {
        setTimeout(connectWebSocket, 3000);
      }
    };

    websocketRef.current.onerror = (error: Event) => {
      if (mountedRef.current) {
        console.error("WebSocket error:", error);
      }
    };
  };

  useEffect(() => {
    if (!excalidrawAPI) return;

    mountedRef.current = true;
    connectWebSocket();

    return () => {
      mountedRef.current = false;
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.close();
      }
    };
  }, [excalidrawAPI]);

  return (
    <Excalidraw
      excalidrawAPI={(api) => setExcalidrawAPI(api as unknown as ExcalidrawImperativeAPI)}
      theme={props.theme ?? "light"}
      initialData={props.initialData as Parameters<typeof Excalidraw>[0]["initialData"]}
      onChange={(elements) => handleExcalidrawChange(elements as unknown as readonly ExcalidrawElement[])}
    />
  );
}

export type { ServerElement, ExcalidrawMessage };
