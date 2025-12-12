import { http, HttpResponse } from "msw";
import type {
  Problem,
  ProblemWithStatement,
  ProblemsListResponse,
  ProblemDetailResponse,
} from "@shared/types/api";

// Default test data
export const mockProblems: Problem[] = [
  {
    id: "url-shortener",
    category: "Classic Problems",
    title: "URL Shortener",
    description: "Design a URL shortening service like bit.ly",
  },
  {
    id: "rate-limiter",
    category: "Classic Problems",
    title: "Rate Limiter",
    description: "Design a rate limiting system for APIs",
  },
  {
    id: "chat-system",
    category: "Real-Time Systems",
    title: "Chat System",
    description: "Design a real-time chat application",
  },
];

export const mockProblemDetails: Record<string, ProblemWithStatement> = {
  "url-shortener": {
    ...mockProblems[0],
    statement:
      "Design a URL shortening service that takes long URLs and creates short aliases. The service should handle redirects and track analytics.",
  },
  "rate-limiter": {
    ...mockProblems[1],
    statement:
      "Design a rate limiter that restricts the number of requests a user can make to an API within a given time window.",
  },
  "chat-system": {
    ...mockProblems[2],
    statement:
      "Design a real-time chat system that supports direct messages and group chats with message persistence.",
  },
};

// Use wildcard patterns to match both relative URLs (/api/...) and full URLs
export const handlers = [
  // GET /api/problems - List all problems
  http.get("*/api/problems", ({ request }) => {
    // Don't match if there's a path segment after /problems (let the :problemId handler catch it)
    const url = new URL(request.url);
    if (url.pathname !== "/api/problems") {
      return;
    }
    const response: ProblemsListResponse = {
      success: true,
      problems: mockProblems,
    };
    return HttpResponse.json(response);
  }),

  // GET /api/problems/:problemId - Get single problem with statement
  http.get("*/api/problems/:problemId", ({ params }) => {
    const { problemId } = params;
    const problem = mockProblemDetails[problemId as string];

    if (!problem) {
      const response: ProblemDetailResponse = {
        success: false,
        error: "Problem not found",
      };
      return HttpResponse.json(response, { status: 404 });
    }

    const response: ProblemDetailResponse = {
      success: true,
      problem,
    };
    return HttpResponse.json(response);
  }),

  // GET /api/health - Health check
  http.get("*/api/health", () => {
    return HttpResponse.json({
      status: "ok",
      roomCount: 0,
      clientCount: 0,
      redis: {
        enabled: false,
        connected: false,
      },
    });
  }),
];
