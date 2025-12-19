import { useState, useCallback, useMemo } from "react";

export interface CommentStep {
  stepNumber: number;
  content: string;
  timestamp: string;
}

interface UseUserCommentStepsReturn {
  // State
  steps: CommentStep[];
  currentStepIndex: number;
  latestDraft: string;

  // Derived values
  currentStepContent: string;
  isViewingLatestStep: boolean;
  totalSteps: number;

  // Actions
  setLatestDraft: (draft: string) => void;
  selectStep: (stepNumber: number) => void;
  initializeFromHistory: (comments: CommentStep[]) => void;
  resetAfterSubmit: (submittedComments?: string) => void;
}

export function useUserCommentSteps(): UseUserCommentStepsReturn {
  // Array of historical steps (submitted feedback comments)
  const [steps, setSteps] = useState<CommentStep[]>([]);

  // Currently selected step index (-1 means "new step" / latest draft)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);

  // Draft text for the latest/new step (retained in memory)
  const [latestDraft, setLatestDraft] = useState<string>("");

  // Derived: total number of displayable steps (history + 1 for current)
  const totalSteps = steps.length + 1;

  // Derived: are we viewing the latest editable step?
  const isViewingLatestStep =
    currentStepIndex === -1 || currentStepIndex === steps.length;

  // Derived: content to display in TextField
  const currentStepContent = useMemo(() => {
    if (isViewingLatestStep) {
      return latestDraft;
    }
    return steps[currentStepIndex]?.content ?? "";
  }, [currentStepIndex, steps, latestDraft, isViewingLatestStep]);

  // Select a step by its 1-based step number
  const selectStep = useCallback(
    (stepNumber: number) => {
      // stepNumber is 1-based, convert to 0-based index
      const index = stepNumber - 1;
      if (stepNumber === steps.length + 1) {
        // Selecting the "new" step
        setCurrentStepIndex(-1);
      } else if (index >= 0 && index < steps.length) {
        setCurrentStepIndex(index);
      }
    },
    [steps.length]
  );

  // Initialize from server history
  const initializeFromHistory = useCallback((comments: CommentStep[]) => {
    setSteps(comments);
    // Default to latest step (the new/editable one)
    setCurrentStepIndex(-1);
  }, []);

  // Reset after submit: clear draft, add submitted content to history
  const resetAfterSubmit = useCallback((submittedComments?: string) => {
    // Use provided comments or fall back to latestDraft
    const contentToSave = submittedComments ?? latestDraft;
    // Move content to steps array if it has content
    if (contentToSave.trim()) {
      const newStep: CommentStep = {
        stepNumber: steps.length + 1,
        content: contentToSave,
        timestamp: new Date().toISOString(),
      };
      setSteps((prev) => [...prev, newStep]);
    }
    setLatestDraft("");
    setCurrentStepIndex(-1);
  }, [latestDraft, steps.length]);

  return {
    steps,
    currentStepIndex,
    latestDraft,
    currentStepContent,
    isViewingLatestStep,
    totalSteps,
    setLatestDraft,
    selectStep,
    initializeFromHistory,
    resetAfterSubmit,
  };
}
