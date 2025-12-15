import { useState, useCallback, useMemo } from "react";

export interface ProblemStatementStep {
  stepNumber: number;
  content: string;
  timestamp: string;
}

interface UseProblemStatementStepsReturn {
  // State
  steps: ProblemStatementStep[];
  currentStepIndex: number;

  // Derived values
  currentStepContent: string;
  isViewingLatestStep: boolean;
  totalSteps: number;

  // Actions
  selectStep: (stepNumber: number) => void;
  initializeFromHistory: (statements: ProblemStatementStep[]) => void;
  setInitialProblem: (content: string) => void;
  addNextPrompt: (content: string) => void;
}

export function useProblemStatementSteps(): UseProblemStatementStepsReturn {
  // Array of problem statement steps
  const [steps, setSteps] = useState<ProblemStatementStep[]>([]);

  // Currently selected step index (-1 means viewing latest)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);

  // Derived: total number of displayable steps
  const totalSteps = steps.length;

  // Derived: are we viewing the latest step?
  const isViewingLatestStep =
    currentStepIndex === -1 || currentStepIndex === steps.length - 1;

  // Derived: content to display
  const currentStepContent = useMemo(() => {
    if (steps.length === 0) {
      return "";
    }
    if (isViewingLatestStep) {
      return steps[steps.length - 1]?.content ?? "";
    }
    return steps[currentStepIndex]?.content ?? "";
  }, [currentStepIndex, steps, isViewingLatestStep]);

  // Select a step by its 1-based step number
  const selectStep = useCallback(
    (stepNumber: number) => {
      // stepNumber is 1-based, convert to 0-based index
      const index = stepNumber - 1;
      if (index >= 0 && index < steps.length) {
        if (index === steps.length - 1) {
          // Selecting latest step
          setCurrentStepIndex(-1);
        } else {
          setCurrentStepIndex(index);
        }
      }
    },
    [steps.length]
  );

  // Initialize from server history (includes initial problem + any next prompts)
  const initializeFromHistory = useCallback((statements: ProblemStatementStep[]) => {
    setSteps(statements);
    // Default to latest step
    setCurrentStepIndex(-1);
  }, []);

  // Set initial problem (called from fetchProblem)
  // Only sets if no steps exist yet (to avoid overwriting server history)
  const setInitialProblem = useCallback((content: string) => {
    setSteps((prev) => {
      if (prev.length > 0) {
        // Already have history from server, don't overwrite
        return prev;
      }
      return [{
        stepNumber: 1,
        content,
        timestamp: new Date().toISOString(),
      }];
    });
    setCurrentStepIndex(-1);
  }, []);

  // Add next prompt (called when next-prompt message arrives)
  const addNextPrompt = useCallback((content: string) => {
    const newStep: ProblemStatementStep = {
      stepNumber: steps.length + 1,
      content,
      timestamp: new Date().toISOString(),
    };
    setSteps((prev) => [...prev, newStep]);
    // Reset to view latest
    setCurrentStepIndex(-1);
  }, [steps.length]);

  return {
    steps,
    currentStepIndex,
    currentStepContent,
    isViewingLatestStep,
    totalSteps,
    selectStep,
    initializeFromHistory,
    setInitialProblem,
    addNextPrompt,
  };
}
