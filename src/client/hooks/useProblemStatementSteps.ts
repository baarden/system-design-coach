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

  // Initialize from server history (these are updates/next prompts, step 2+)
  // Server numbers them starting at 1, but they're actually updates that follow the original
  const initializeFromHistory = useCallback((statements: ProblemStatementStep[]) => {
    setSteps((prev) => {
      // Renumber server history as step 2+ (original is always step 1)
      const renumbered = statements.map((item, index) => ({
        ...item,
        stepNumber: index + 2,
      }));

      // If we already have the original (step 1), prepend it
      const step1 = prev.find(s => s.stepNumber === 1);
      if (step1) {
        return [step1, ...renumbered];
      }

      // No original yet - just store renumbered history (step 1 will be added later)
      return renumbered;
    });
    setCurrentStepIndex(-1);
  }, []);

  // Set initial problem (called from fetchProblem)
  const setInitialProblem = useCallback((content: string) => {
    setSteps((prev) => {
      const step1: ProblemStatementStep = {
        stepNumber: 1,
        content,
        timestamp: new Date().toISOString(),
      };

      if (prev.length === 0) {
        // No history yet, just set step 1
        return [step1];
      }

      // Check if step 1 already exists (from a previous setInitialProblem call)
      const hasStep1 = prev.some(s => s.stepNumber === 1);
      if (hasStep1) {
        // Replace existing step 1, keep the rest
        return [step1, ...prev.filter(s => s.stepNumber > 1)];
      }

      // History exists but no step 1 - prepend original and renumber history as step 2+
      const renumbered = prev.map((item, index) => ({
        ...item,
        stepNumber: index + 2,
      }));
      return [step1, ...renumbered];
    });
    setCurrentStepIndex(-1);
  }, []);

  // Add next prompt (called when next-prompt message arrives)
  const addNextPrompt = useCallback((content: string) => {
    setSteps((prev) => {
      const newStep: ProblemStatementStep = {
        stepNumber: prev.length + 1,
        content,
        timestamp: new Date().toISOString(),
      };
      return [...prev, newStep];
    });
    // Reset to view latest
    setCurrentStepIndex(-1);
  }, []);

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
