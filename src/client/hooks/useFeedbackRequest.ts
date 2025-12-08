import { useState, useRef, useCallback, MutableRefObject } from "react";

interface ExcalidrawApi {
  send: (message: unknown) => void;
  syncToBackend: () => Promise<void>;
}

interface UseFeedbackRequestOptions {
  excalidrawApiRef: MutableRefObject<ExcalidrawApi | null>;
  roomId: string | null;
  userId: string;
  userComments: string;
  onError: (message: string) => void;
}

interface UseFeedbackRequestReturn {
  handleGetFeedback: () => Promise<void>;
  isFeedbackLoading: boolean;
  setIsFeedbackLoading: (loading: boolean) => void;
  pendingEventIdRef: MutableRefObject<string | null>;
}

/**
 * Hook to handle feedback request flow.
 * Manages syncing Excalidraw and sending feedback request via WebSocket.
 */
export function useFeedbackRequest({
  excalidrawApiRef,
  roomId,
  userId,
  userComments,
  onError,
}: UseFeedbackRequestOptions): UseFeedbackRequestReturn {
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const pendingEventIdRef = useRef<string | null>(null);

  const handleGetFeedback = useCallback(async () => {
    if (!excalidrawApiRef.current || !roomId) {
      return;
    }

    // Generate unique event ID
    const eventId = crypto.randomUUID();

    try {
      // Set loading state
      setIsFeedbackLoading(true);
      pendingEventIdRef.current = eventId;

      // Trigger sync of Excalidraw
      await excalidrawApiRef.current.syncToBackend();

      // Send get-feedback WebSocket event
      const message = {
        type: "get-feedback",
        eventId,
        userComments,
        userId,
      };

      excalidrawApiRef.current.send(message);
    } catch (error) {
      // If sync fails, show error and re-enable button
      console.error("Error getting feedback:", error);
      setIsFeedbackLoading(false);
      pendingEventIdRef.current = null;
      onError(
        error instanceof Error ? error.message : "Failed to sync Excalidraw"
      );
    }
  }, [excalidrawApiRef, roomId, userId, userComments, onError]);

  return {
    handleGetFeedback,
    isFeedbackLoading,
    setIsFeedbackLoading,
    pendingEventIdRef,
  };
}
