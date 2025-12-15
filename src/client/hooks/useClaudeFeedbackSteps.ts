import { useState, useCallback, useMemo } from "react";

export interface FeedbackStep {
  stepNumber: number;
  content: string;
  timestamp: string;
}

interface UseClaudeFeedbackStepsReturn {
  // State
  steps: FeedbackStep[];
  currentStepIndex: number;

  // Derived values
  currentStepContent: string;
  isViewingLatestStep: boolean;
  totalSteps: number;

  // Actions
  selectStep: (stepNumber: number) => void;
  initializeFromHistory: (feedbackItems: FeedbackStep[]) => void;
  addNewFeedback: (content: string) => void;
}

export function useClaudeFeedbackSteps(): UseClaudeFeedbackStepsReturn {
  // Array of feedback steps (from Claude responses)
  const [steps, setSteps] = useState<FeedbackStep[]>([]);

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

  // Initialize from server history
  const initializeFromHistory = useCallback((feedbackItems: FeedbackStep[]) => {
    setSteps(feedbackItems);
    // Default to latest step
    setCurrentStepIndex(-1);
  }, []);

  // Add new feedback (called when claude-feedback message arrives)
  const addNewFeedback = useCallback((content: string) => {
    const newStep: FeedbackStep = {
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
    addNewFeedback,
  };
}
