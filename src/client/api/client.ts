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
