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

  it("merges server history with original problem from setInitialProblem", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    // Server sends history (updates only, step 2+) - simulating history arriving first
    const serverHistory = [
      { stepNumber: 1, content: "Updated problem", timestamp: "2024-01-02T00:00:00Z" },
    ];

    act(() => {
      result.current.initializeFromHistory(serverHistory);
    });

    // Then fetchProblem resolves and sets the original
    act(() => {
      result.current.setInitialProblem("Original problem");
    });

    // Original becomes step 1, server history becomes step 2
    expect(result.current.steps).toHaveLength(2);
    expect(result.current.steps[0].content).toBe("Original problem");
    expect(result.current.steps[0].stepNumber).toBe(1);
    expect(result.current.steps[1].content).toBe("Updated problem");
    expect(result.current.steps[1].stepNumber).toBe(2);
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

  it("initializes from history and renumbers as step 2+", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    // Server sends history with its own numbering (starting at 1)
    const serverHistory = [
      { stepNumber: 1, content: "Update 1", timestamp: "2024-01-01T00:00:00Z" },
      { stepNumber: 2, content: "Update 2", timestamp: "2024-01-02T00:00:00Z" },
    ];

    act(() => {
      result.current.initializeFromHistory(serverHistory);
    });

    // History is renumbered as step 2+ (step 1 reserved for original)
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.steps[0].stepNumber).toBe(2);
    expect(result.current.steps[0].content).toBe("Update 1");
    expect(result.current.steps[1].stepNumber).toBe(3);
    expect(result.current.steps[1].content).toBe("Update 2");
    expect(result.current.currentStepContent).toBe("Update 2");
  });

  it("selects historical step", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    // Set up: original problem + one update
    act(() => {
      result.current.setInitialProblem("Original problem");
    });

    act(() => {
      result.current.addNextPrompt("Updated problem");
    });

    // Select step 1 (original)
    act(() => {
      result.current.selectStep(1);
    });

    expect(result.current.currentStepContent).toBe("Original problem");
    expect(result.current.isViewingLatestStep).toBe(false);
  });

  it("returns to latest step when selecting last step", () => {
    const { result } = renderHook(() => useProblemStatementSteps());

    // Set up: original problem + one update
    act(() => {
      result.current.setInitialProblem("Original problem");
    });

    act(() => {
      result.current.addNextPrompt("Updated problem");
    });

    // Select step 1
    act(() => {
      result.current.selectStep(1);
    });

    // Select step 2 (latest)
    act(() => {
      result.current.selectStep(2);
    });

    expect(result.current.currentStepContent).toBe("Updated problem");
    expect(result.current.isViewingLatestStep).toBe(true);
  });
});
