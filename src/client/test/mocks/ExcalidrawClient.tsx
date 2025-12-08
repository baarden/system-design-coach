import { useEffect, useRef } from "react";
import { vi } from "vitest";

/**
 * Mock ExcalidrawClient component for testing.
 * Simulates the WebSocket-based Excalidraw collaboration client.
 */

export interface MockExcalidrawAPI {
  addFiles: ReturnType<typeof vi.fn>;
  updateScene: ReturnType<typeof vi.fn>;
  getSceneElements: ReturnType<typeof vi.fn>;
}

export interface MockExcalidrawApi {
  send: ReturnType<typeof vi.fn>;
  syncToBackend: ReturnType<typeof vi.fn>;
  excalidrawAPI: MockExcalidrawAPI;
}

export interface ExcalidrawClientProps {
  serverUrl: string;
  roomId: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReady?: (api: MockExcalidrawApi, initialElements: unknown[]) => void;
  onMessage?: (message: unknown) => void;
  onSync?: (count: number) => void;
  onSyncError?: (error: Error) => void;
}

// Store for controlling the mock from tests
export const mockExcalidrawState = {
  api: null as MockExcalidrawApi | null,
  onMessage: null as ((message: unknown) => void) | null,
  isConnected: false,
};

export function resetMockExcalidrawState() {
  mockExcalidrawState.api = null;
  mockExcalidrawState.onMessage = null;
  mockExcalidrawState.isConnected = false;
}

/**
 * Simulate receiving a WebSocket message
 */
export function simulateWebSocketMessage(message: unknown) {
  if (mockExcalidrawState.onMessage) {
    mockExcalidrawState.onMessage(message);
  }
}

/**
 * Get the mock API to verify calls
 */
export function getMockApi(): MockExcalidrawApi | null {
  return mockExcalidrawState.api;
}

export function MockExcalidrawClient({
  serverUrl,
  roomId,
  onConnect,
  onDisconnect: _onDisconnect,
  onReady,
  onMessage,
  onSync: _onSync,
  onSyncError: _onSyncError,
}: ExcalidrawClientProps) {
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Create mock excalidraw API
    const mockExcalidrawAPI: MockExcalidrawAPI = {
      addFiles: vi.fn(),
      updateScene: vi.fn(),
      getSceneElements: vi.fn().mockReturnValue([]),
    };

    // Create mock API
    const mockApi: MockExcalidrawApi = {
      send: vi.fn(),
      syncToBackend: vi.fn().mockResolvedValue(undefined),
      excalidrawAPI: mockExcalidrawAPI,
    };

    // Store for test access
    mockExcalidrawState.api = mockApi;
    mockExcalidrawState.onMessage = onMessage || null;
    mockExcalidrawState.isConnected = true;

    // Simulate connection and initial sync (empty room)
    onConnect?.();
    onReady?.(mockApi, []);
  }, [onConnect, onReady, onMessage]);

  return (
    <div data-testid="excalidraw-client" data-room-id={roomId} data-server-url={serverUrl}>
      <div data-testid="excalidraw-canvas">Mock Excalidraw Canvas</div>
    </div>
  );
}

export default MockExcalidrawClient;
