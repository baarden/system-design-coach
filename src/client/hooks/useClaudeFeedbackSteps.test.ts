import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClaudeFeedbackSteps } from "./useClaudeFeedbackSteps";

describe("useClaudeFeedbackSteps", () => {
  it("initializes with empty state", () => {
    const { result } = renderHook(() => useClaudeFeedbackSteps());

    expect(result.current.steps).toEqual([]);
    expect(result.current.totalSteps).toBe(0);
    expect(result.current.currentStepContent).toBe("");
  });

  it("adds new feedback", () => {
    const { result } = renderHook(() => useClaudeFeedbackSteps());

    act(() => {
      result.current.addNewFeedback("First feedback");
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].content).toBe("First feedback");
    expect(result.current.totalSteps).toBe(1);
    expect(result.current.currentStepContent).toBe("First feedback");
  });

  it("adds multiple feedbacks", () => {
    const { result } = renderHook(() => useClaudeFeedbackSteps());

    act(() => {
      result.current.addNewFeedback("First feedback");
    });
    act(() => {
      result.current.addNewFeedback("Second feedback");
    });

    expect(result.current.steps).toHaveLength(2);
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.currentStepContent).toBe("Second feedback");
  });

  it("initializes from history", () => {
    const { result } = renderHook(() => useClaudeFeedbackSteps());

    const history = [
      { stepNumber: 1, content: "Feedback 1", timestamp: "2024-01-01T00:00:00Z" },
      { stepNumber: 2, content: "Feedback 2", timestamp: "2024-01-02T00:00:00Z" },
    ];

    act(() => {
      result.current.initializeFromHistory(history);
    });

    expect(result.current.steps).toEqual(history);
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.currentStepContent).toBe("Feedback 2");
  });

  it("selects historical step", () => {
    const { result } = renderHook(() => useClaudeFeedbackSteps());

    const history = [
      { stepNumber: 1, content: "Feedback 1", timestamp: "2024-01-01T00:00:00Z" },
      { stepNumber: 2, content: "Feedback 2", timestamp: "2024-01-02T00:00:00Z" },
    ];

    act(() => {
      result.current.initializeFromHistory(history);
    });

    act(() => {
      result.current.selectStep(1);
    });

    expect(result.current.currentStepContent).toBe("Feedback 1");
    expect(result.current.isViewingLatestStep).toBe(false);
  });

  it("returns to latest step when selecting last step", () => {
    const { result } = renderHook(() => useClaudeFeedbackSteps());

    const history = [
      { stepNumber: 1, content: "Feedback 1", timestamp: "2024-01-01T00:00:00Z" },
      { stepNumber: 2, content: "Feedback 2", timestamp: "2024-01-02T00:00:00Z" },
    ];

    act(() => {
      result.current.initializeFromHistory(history);
    });

    act(() => {
      result.current.selectStep(1);
    });

    act(() => {
      result.current.selectStep(2);
    });

    expect(result.current.currentStepContent).toBe("Feedback 2");
    expect(result.current.isViewingLatestStep).toBe(true);
  });
});
