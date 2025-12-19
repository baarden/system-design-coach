import { useState, useMemo, useCallback } from "react";
import type { CommentStep } from "./useUserCommentSteps";
import type { FeedbackStep } from "./useClaudeFeedbackSteps";
import type { ProblemStatementStep } from "./useProblemStatementSteps";

interface UseUnifiedStepNavigationOptions {
  commentSteps: CommentStep[];
  feedbackSteps: FeedbackStep[];
  problemSteps: ProblemStatementStep[];
  currentComments: string;
}

interface UseUnifiedStepNavigationReturn {
  viewingStepNumber: number | null;
  totalRounds: number;
  isViewingCurrent: boolean;
  displayedCommentContent: string;
  displayedCoachContent: string;
  selectStep: (stepNumber: number) => void;
  resetToCurrentStep: () => void;
}

/**
 * Hook for unified step navigation across comments, feedback, and problem statement.
 * All sections sync to the same step when navigating through history.
 */
export function useUnifiedStepNavigation({
  commentSteps,
  feedbackSteps,
  problemSteps,
  currentComments,
}: UseUnifiedStepNavigationOptions): UseUnifiedStepNavigationReturn {
  // null = viewing current/latest, number = viewing historical step
  const [viewingStepNumber, setViewingStepNumber] = useState<number | null>(null);

  // Total rounds based on user comments (which drives interaction rounds)
  // +1 for the current editable step
  const totalRounds = commentSteps.length + 1;

  // Are we viewing the current/latest step?
  const isViewingCurrent = viewingStepNumber === null || viewingStepNumber >= totalRounds;

  // Derive displayed content for each section based on shared step
  const displayedCommentContent = useMemo(() => {
    if (isViewingCurrent) return currentComments;
    return commentSteps[viewingStepNumber! - 1]?.content ?? '';
  }, [isViewingCurrent, viewingStepNumber, commentSteps, currentComments]);

  // Compute feedback content for the current step
  const feedbackContent = useMemo(() => {
    if (feedbackSteps.length === 0) return '';
    if (isViewingCurrent) return feedbackSteps[feedbackSteps.length - 1]?.content ?? '';
    // Step 1 has no feedback (feedback comes after first submission)
    if (viewingStepNumber === 1) return '';
    // Show feedback for this step (step N corresponds to feedback N-1), or latest available
    const stepIndex = Math.min(viewingStepNumber! - 2, feedbackSteps.length - 1);
    return stepIndex >= 0 ? feedbackSteps[stepIndex]?.content ?? '' : '';
  }, [isViewingCurrent, viewingStepNumber, feedbackSteps]);

  // Compute problem content for the current step
  const problemContent = useMemo(() => {
    if (problemSteps.length === 0) return '';
    if (isViewingCurrent) return problemSteps[problemSteps.length - 1]?.content ?? '';
    // Show problem statement for this step, or latest available if step doesn't exist
    const stepIndex = Math.min(viewingStepNumber! - 1, problemSteps.length - 1);
    return problemSteps[stepIndex]?.content ?? '';
  }, [isViewingCurrent, viewingStepNumber, problemSteps]);

  // Combined coach content: feedback (if any) + problem statement with prefix
  const displayedCoachContent = useMemo(() => {
    const problemWithPrefix = problemContent
      ? `**Current problem statement:**\n\n${problemContent}`
      : '';

    if (feedbackContent) {
      return `${feedbackContent}\n\n${problemWithPrefix}`;
    }
    return problemWithPrefix;
  }, [feedbackContent, problemContent]);

  // Unified step selector
  const selectStep = useCallback((stepNumber: number) => {
    if (stepNumber >= totalRounds) {
      setViewingStepNumber(null); // Current
    } else {
      setViewingStepNumber(stepNumber);
    }
  }, [totalRounds]);

  // Reset to viewing current step
  const resetToCurrentStep = useCallback(() => {
    setViewingStepNumber(null);
  }, []);

  return {
    viewingStepNumber,
    totalRounds,
    isViewingCurrent,
    displayedCommentContent,
    displayedCoachContent,
    selectStep,
    resetToCurrentStep,
  };
}
