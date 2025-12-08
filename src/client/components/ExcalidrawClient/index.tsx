/**
 * ExcalidrawClient - A React component that wraps Excalidraw with WebSocket sync.
 * Thanks to mcp-excalidraw (https://github.com/anthropics/mcp-excalidraw) for the original implementation.
 */

import { useState, useEffect, useRef } from "react";
import {
  Excalidraw,
  convertToExcalidrawElements,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import type { ServerElement, ExcalidrawMessage } from "@shared/types/excalidraw";

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
const validateAndFixBindings = (
  elements: Partial<ExcalidrawElement>[]
): Partial<ExcalidrawElement>[] => {
  const elementMap = new Map(elements.map((el) => [el.id!, el]));

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

  excalidrawAPIRef.current = excalidrawAPI;

  const baseUrl =
    props.serverUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const roomIdPath = props.roomId ? `/${props.roomId}` : "";

  const send = (message: unknown): void => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
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
          if (elements.length > 0) {
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
          const elements = data.elements as ServerElement[];
          if (elements) {
            const cleanedBatchElements = elements.map(cleanElementForExcalidraw);
            const batchElements = convertToExcalidrawElements(
              cleanedBatchElements as Parameters<typeof convertToExcalidrawElements>[0]
            );
            excalidrawAPI.updateScene({
              elements: [...currentElements, ...batchElements],
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
    const wsUrl = `${wsBaseUrl}${roomIdPath}`;

    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => {
      props.onConnect?.();
      // Note: onReady is NOT fired here. It fires after initial_elements arrives.
    };

    websocketRef.current.onmessage = (event: MessageEvent) => {
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
    />
  );
}

export type { ServerElement, ExcalidrawMessage };
