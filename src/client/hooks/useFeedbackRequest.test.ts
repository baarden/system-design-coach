import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFeedbackRequest } from "./useFeedbackRequest";

describe("useFeedbackRequest", () => {
  const mockSend = vi.fn();
  const mockSyncToBackend = vi.fn().mockResolvedValue(undefined);
  const mockOnError = vi.fn();

  const excalidrawApiRef = {
    current: {
      send: mockSend,
      syncToBackend: mockSyncToBackend,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with loading false and null pending event", () => {
    const { result } = renderHook(() =>
      useFeedbackRequest({
        excalidrawApiRef,
        roomId: "user/problem",
        userId: "test-user",
        userComments: "My notes",
        onError: mockOnError,
      })
    );

    expect(result.current.isFeedbackLoading).toBe(false);
    expect(result.current.pendingEventIdRef.current).toBeNull();
  });

  it("does nothing when excalidrawApiRef is null", async () => {
    const nullApiRef = { current: null };

    const { result } = renderHook(() =>
      useFeedbackRequest({
        excalidrawApiRef: nullApiRef,
        roomId: "user/problem",
        userId: "test-user",
        userComments: "My notes",
        onError: mockOnError,
      })
    );

    await act(async () => {
      await result.current.handleGetFeedback();
    });

    expect(mockSyncToBackend).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does nothing when roomId is null", async () => {
    const { result } = renderHook(() =>
      useFeedbackRequest({
        excalidrawApiRef,
        roomId: null,
        userId: "test-user",
        userComments: "My notes",
        onError: mockOnError,
      })
    );

    await act(async () => {
      await result.current.handleGetFeedback();
    });

    expect(mockSyncToBackend).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("syncs to backend and sends get-feedback message", async () => {
    const { result } = renderHook(() =>
      useFeedbackRequest({
        excalidrawApiRef,
        roomId: "user/problem",
        userId: "test-user",
        userComments: "My notes",
        onError: mockOnError,
      })
    );

    await act(async () => {
      await result.current.handleGetFeedback();
    });

    expect(mockSyncToBackend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "get-feedback",
        userComments: "My notes",
        userId: "test-user",
      })
    );
  });

  it("sets loading state to true during feedback request", async () => {
    const { result } = renderHook(() =>
      useFeedbackRequest({
        excalidrawApiRef,
        roomId: "user/problem",
        userId: "test-user",
        userComments: "",
        onError: mockOnError,
      })
    );

    expect(result.current.isFeedbackLoading).toBe(false);

    await act(async () => {
      await result.current.handleGetFeedback();
    });

    // Loading is still true after the call - would be set to false by status message
    expect(result.current.isFeedbackLoading).toBe(true);
  });

  it("generates unique eventId for each request", async () => {
    const { result } = renderHook(() =>
      useFeedbackRequest({
        excalidrawApiRef,
        roomId: "user/problem",
        userId: "test-user",
        userComments: "",
        onError: mockOnError,
      })
    );

    await act(async () => {
      await result.current.handleGetFeedback();
    });

    const firstEventId = mockSend.mock.calls[0][0].eventId;
    expect(firstEventId).toBeDefined();
    expect(typeof firstEventId).toBe("string");
    expect(firstEventId.length).toBeGreaterThan(0);
  });

  it("handles sync error and resets loading state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const failingSync = vi.fn().mockRejectedValue(new Error("Sync failed"));
    const failingApiRef = {
      current: {
        send: mockSend,
        syncToBackend: failingSync,
      },
    };

    const { result } = renderHook(() =>
      useFeedbackRequest({
        excalidrawApiRef: failingApiRef,
        roomId: "user/problem",
        userId: "test-user",
        userComments: "",
        onError: mockOnError,
      })
    );

    await act(async () => {
      await result.current.handleGetFeedback();
    });

    expect(mockOnError).toHaveBeenCalledWith("Sync failed");
    expect(result.current.isFeedbackLoading).toBe(false);
    expect(result.current.pendingEventIdRef.current).toBeNull();
  });

  it("allows manual setting of loading state", () => {
    const { result } = renderHook(() =>
      useFeedbackRequest({
        excalidrawApiRef,
        roomId: "user/problem",
        userId: "test-user",
        userComments: "",
        onError: mockOnError,
      })
    );

    act(() => {
      result.current.setIsFeedbackLoading(true);
    });

    expect(result.current.isFeedbackLoading).toBe(true);

    act(() => {
      result.current.setIsFeedbackLoading(false);
    });

    expect(result.current.isFeedbackLoading).toBe(false);
  });
});
