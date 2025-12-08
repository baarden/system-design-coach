/**
 * Excalidraw element and WebSocket message types.
 * Thanks to mcp-excalidraw (https://github.com/anthropics/mcp-excalidraw) for the original type definitions.
 */

import type { WebSocket } from "ws";

// Element types
export type ExcalidrawElementType =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "text"
  | "line"
  | "freedraw"
  | "image"
  | "frame";

export interface ExcalidrawBoundElement {
  id: string;
  type: "text" | "arrow";
}

export interface ExcalidrawBinding {
  elementId: string;
  focus: number;
  gap: number;
  fixedPoint?: readonly [number, number] | null;
}

export interface ExcalidrawElementBase {
  id: string;
  type: ExcalidrawElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  roughness?: number;
  opacity?: number;
  groupIds?: string[];
  frameId?: string | null;
  roundness?: {
    type: number;
    value?: number;
  } | null;
  seed?: number;
  versionNonce?: number;
  isDeleted?: boolean;
  locked?: boolean;
  link?: string | null;
  customData?: Record<string, unknown> | null;
  boundElements?: readonly ExcalidrawBoundElement[] | null;
  updated?: number;
  containerId?: string | null;
}

// Server-side element with metadata
export interface ServerElement extends ExcalidrawElementBase {
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  syncedAt?: string;
  source?: string;
  syncTimestamp?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string | number;
  label?: {
    text: string;
  };
}

// WebSocket message types for Excalidraw sync
export type ExcalidrawMessageType =
  | "initial_elements"
  | "element_created"
  | "element_updated"
  | "element_deleted"
  | "elements_batch_created"
  | "elements_synced"
  | "sync_status";

export interface ExcalidrawMessage {
  type: ExcalidrawMessageType | string;
  [key: string]: unknown;
}

export interface InitialElementsMessage extends ExcalidrawMessage {
  type: "initial_elements";
  elements: ServerElement[];
}

export interface ElementCreatedMessage extends ExcalidrawMessage {
  type: "element_created";
  element: ServerElement;
}

export interface ElementUpdatedMessage extends ExcalidrawMessage {
  type: "element_updated";
  element: ServerElement;
}

export interface ElementDeletedMessage extends ExcalidrawMessage {
  type: "element_deleted";
  elementId: string;
}

export interface BatchCreatedMessage extends ExcalidrawMessage {
  type: "elements_batch_created";
  elements: ServerElement[];
}

export interface SyncStatusMessage extends ExcalidrawMessage {
  type: "sync_status";
  elementCount: number;
  timestamp: string;
}

// Manager interfaces
export interface StateManager {
  getElements(roomId?: string): Map<string, ServerElement>;
  getElement(elementId: string, roomId?: string): ServerElement | undefined;
  setElement(elementId: string, element: ServerElement, roomId?: string): void;
  deleteElement(elementId: string, roomId?: string): boolean;
  clearElements(roomId?: string): void;
}

export interface ClientManager {
  addClient(ws: WebSocket, roomId?: string): void;
  removeClient(ws: WebSocket): void;
  getClients(roomId?: string): Set<WebSocket>;
  getRoomForClient(ws: WebSocket): string | undefined;
  broadcast(
    message: ExcalidrawMessage,
    roomId?: string,
    excludeClient?: WebSocket
  ): void;
}
