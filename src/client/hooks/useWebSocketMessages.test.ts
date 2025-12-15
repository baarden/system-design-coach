import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWebSocketMessages } from "./useWebSocketMessages";

// Mock the auth provider
vi.mock("../providers/auth", () => ({
  ENABLE_AUTH: false,
}));

describe("useWebSocketMessages", () => {
  const mockHandlers = {
    onChatMessage: vi.fn(),
    onClaudeFeedback: vi.fn(),
    onNextPrompt: vi.fn(),
    onFeedbackComplete: vi.fn(),
    onFeedbackError: vi.fn(),
    onError: vi.fn(),
    onUserCommentsReset: vi.fn(),
    onUserCommentHistory: vi.fn(),
    onClaudeFeedbackHistory: vi.fn(),
    onProblemStatementHistory: vi.fn(),
    reloadUser: vi.fn(),
  };

  const pendingEventIdRef = { current: null as string | null };

  beforeEach(() => {
    vi.clearAllMocks();
    pendingEventIdRef.current = null;
  });

  it("routes chat-history messages to onChatMessage", () => {
    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "chat-history",
      messages: [{ role: "assistant", content: "Hello", timestamp: "123", source: "chat" }],
    });

    expect(mockHandlers.onChatMessage).toHaveBeenCalledTimes(1);
    expect(mockHandlers.onChatMessage).toHaveBeenCalledWith({
      type: "chat-history",
      messages: [{ role: "assistant", content: "Hello", timestamp: "123", source: "chat" }],
    });
  });

  it("routes chat-response messages to onChatMessage", () => {
    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "chat-response",
      message: "Hello from Claude",
      timestamp: "123",
    });

    expect(mockHandlers.onChatMessage).toHaveBeenCalledTimes(1);
  });

  it("routes claude-feedback messages to onClaudeFeedback and resets comments", () => {
    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "claude-feedback",
      responseText: "Your design looks good!",
      timestamp: "123",
    });

    expect(mockHandlers.onClaudeFeedback).toHaveBeenCalledWith("Your design looks good!");
    expect(mockHandlers.onUserCommentsReset).toHaveBeenCalledTimes(1);
  });

  it("routes next-prompt messages to onNextPrompt", () => {
    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "next-prompt",
      nextPrompt: "Now consider scaling",
      timestamp: "123",
    });

    expect(mockHandlers.onNextPrompt).toHaveBeenCalledWith("Now consider scaling");
  });

  it("handles conversation_restore messages", () => {
    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "conversation_restore",
      latestFeedback: "Previous feedback",
      timestamp: "123",
    });

    expect(mockHandlers.onClaudeFeedback).toHaveBeenCalledWith("Previous feedback");
  });

  it("handles conversation_restore with currentProblemStatement", () => {
    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "conversation_restore",
      latestFeedback: "Previous feedback",
      currentProblemStatement: "Updated problem statement",
      timestamp: "123",
    });

    expect(mockHandlers.onClaudeFeedback).toHaveBeenCalledWith("Previous feedback");
    expect(mockHandlers.onNextPrompt).toHaveBeenCalledWith("Updated problem statement");
  });

  it("handles status completed messages matching pending eventId", () => {
    pendingEventIdRef.current = "event-123";

    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "status",
      eventId: "event-123",
      status: "completed",
    });

    expect(mockHandlers.onFeedbackComplete).toHaveBeenCalledTimes(1);
    expect(pendingEventIdRef.current).toBeNull();
  });

  it("handles status error messages matching pending eventId", () => {
    pendingEventIdRef.current = "event-456";

    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "status",
      eventId: "event-456",
      status: "error",
      message: "Something went wrong",
    });

    expect(mockHandlers.onFeedbackError).toHaveBeenCalledWith("Something went wrong", undefined);
    expect(pendingEventIdRef.current).toBeNull();
  });

  it("ignores status messages with non-matching eventId", () => {
    pendingEventIdRef.current = "event-123";

    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "status",
      eventId: "different-event",
      status: "completed",
    });

    expect(mockHandlers.onFeedbackComplete).not.toHaveBeenCalled();
    expect(pendingEventIdRef.current).toBe("event-123");
  });

  it("handles error messages ending with -error", () => {
    const { result } = renderHook(() =>
      useWebSocketMessages({
        pendingEventIdRef,
        handlers: mockHandlers,
      })
    );

    result.current.handleWebSocketMessage({
      type: "payment-error",
      message: "Payment failed",
    });

    expect(mockHandlers.onError).toHaveBeenCalledWith("Payment failed");
    expect(mockHandlers.reloadUser).toHaveBeenCalledTimes(1);
  });
});
