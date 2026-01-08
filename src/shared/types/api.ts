/**
 * Shared API types for REST endpoints.
 * These types define the contract between client and server.
 */

// ============================================
// Problem Types
// ============================================

export interface Problem {
  id: string;
  category: string;
  title: string;
  description: string;
}

export interface ProblemWithStatement extends Problem {
  statement: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface ProblemsListResponse {
  success: boolean;
  problems?: Problem[];
  error?: string;
}

export interface ProblemDetailResponse {
  success: boolean;
  problem?: ProblemWithStatement;
  error?: string;
}

export interface HealthResponse {
  status: string;
  roomCount: number;
  clientCount: number;
  redis: {
    enabled: boolean;
    connected: boolean;
  };
}

// ============================================
// Room Types
// ============================================

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
