import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProblemStatementSteps } from "./useProblemStatementSteps";

describe("useProblemStatementSteps", () => {
  it("initializes with empty state", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    expect(result.current.steps).toEqual([]);
    expect(result.current.totalSteps).toBe(0);
    expect(result.current.currentStepContent).toBe("");
  });

  it("sets initial problem", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    act(() => {
      result.current.setInitialProblem("Design a URL shortener");
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].content).toBe("Design a URL shortener");
    expect(result.current.totalSteps).toBe(1);
    expect(result.current.currentStepContent).toBe("Design a URL shortener");
  });

  it("does not overwrite existing steps when setInitialProblem is called", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    const history = [
      { stepNumber: 1, content: "Problem 1", timestamp: "2024-01-01T00:00:00Z" },
    ];

    act(() => {
      result.current.initializeFromHistory(history);
    });

    act(() => {
      result.current.setInitialProblem("Should not overwrite");
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].content).toBe("Problem 1");
  });

  it("adds next prompt", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    act(() => {
      result.current.setInitialProblem("Initial problem");
    });

    act(() => {
      result.current.addNextPrompt("Updated problem from Claude");
    });

    expect(result.current.steps).toHaveLength(2);
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.currentStepContent).toBe("Updated problem from Claude");
  });

  it("initializes from history", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    const history = [
      { stepNumber: 1, content: "Problem 1", timestamp: "2024-01-01T00:00:00Z" },
      { stepNumber: 2, content: "Problem 2", timestamp: "2024-01-02T00:00:00Z" },
    ];

    act(() => {
      result.current.initializeFromHistory(history);
    });

    expect(result.current.steps).toEqual(history);
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.currentStepContent).toBe("Problem 2");
  });

  it("selects historical step", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    const history = [
      { stepNumber: 1, content: "Problem 1", timestamp: "2024-01-01T00:00:00Z" },
      { stepNumber: 2, content: "Problem 2", timestamp: "2024-01-02T00:00:00Z" },
    ];

    act(() => {
      result.current.initializeFromHistory(history);
    });

    act(() => {
      result.current.selectStep(1);
    });

    expect(result.current.currentStepContent).toBe("Problem 1");
    expect(result.current.isViewingLatestStep).toBe(false);
  });

  it("returns to latest step when selecting last step", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    const history = [
      { stepNumber: 1, content: "Problem 1", timestamp: "2024-01-01T00:00:00Z" },
      { stepNumber: 2, content: "Problem 2", timestamp: "2024-01-02T00:00:00Z" },
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

    expect(result.current.currentStepContent).toBe("Problem 2");
    expect(result.current.isViewingLatestStep).toBe(true);
  });
});
