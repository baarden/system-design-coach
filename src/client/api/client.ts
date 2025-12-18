/**
 * API client for server communication.
 * Centralizes all HTTP requests for easier testing and mocking.
 */

import type {
  ProblemsListResponse,
  ProblemDetailResponse,
  HealthResponse,
} from "@shared/types/api";

// Server URL from environment, or empty string for relative URLs (same origin)
const DEFAULT_SERVER_URL = "";

export function getServerUrl(): string {
  return import.meta.env.VITE_SERVER_URL ?? DEFAULT_SERVER_URL;
}

/**
 * Fetch all problems (without full statements)
 */
export async function fetchProblems(): Promise<ProblemsListResponse> {
  const response = await fetch(`${getServerUrl()}/api/problems`);
  return response.json();
}

/**
 * Fetch a single problem with its full statement
 */
export async function fetchProblem(
  problemId: string
): Promise<ProblemDetailResponse> {
  const response = await fetch(`${getServerUrl()}/api/problems/${problemId}`);
  return response.json();
}

/**
 * Fetch server health status
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${getServerUrl()}/api/health`);
  return response.json();
}

// Room API types
export interface RoomResponse {
  success: boolean;
  room?: {
    roomId: string;
    shareUrl?: string;
    problemId: string;
    createdAt?: string;
    tokenCreatedAt?: string;
  };
  error?: string;
}

export interface TokenRegenerateResponse {
  success: boolean;
  shareUrl?: string;
  message?: string;
  error?: string;
}

export interface ResetRoomResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Resolve a share token to room info
 */
export async function resolveToken(token: string): Promise<RoomResponse> {
  const response = await fetch(`${getServerUrl()}/api/rooms/by-token/${token}`);
  return response.json();
}

/**
 * Get room info
 */
export async function getRoom(roomId: string): Promise<RoomResponse> {
  const response = await fetch(`${getServerUrl()}/api/rooms/${roomId}`);
  return response.json();
}

/**
 * Create a room
 */
export async function createRoom(roomId: string): Promise<RoomResponse> {
  const response = await fetch(`${getServerUrl()}/api/rooms/${roomId}`, {
    method: 'POST',
  });
  return response.json();
}

/**
 * Regenerate share token
 */
export async function regenerateToken(roomId: string): Promise<TokenRegenerateResponse> {
  const response = await fetch(`${getServerUrl()}/api/rooms/${roomId}/regenerate-token`, {
    method: 'POST',
  });
  return response.json();
}

/**
 * Reset room content (elements, conversation, diagram)
 */
export async function resetRoomContent(roomId: string): Promise<ResetRoomResponse> {
  const response = await fetch(`${getServerUrl()}/api/rooms/${roomId}/content`, {
    method: 'DELETE',
  });
  return response.json();
}

