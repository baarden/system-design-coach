import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUnifiedStepNavigation } from "./useUnifiedStepNavigation";
import type { CommentStep } from "./useUserCommentSteps";
import type { FeedbackStep } from "./useClaudeFeedbackSteps";
import type { ProblemStatementStep } from "./useProblemStatementSteps";

describe("useUnifiedStepNavigation", () => {
  const mockCommentSteps: CommentStep[] = [
    { stepNumber: 1, content: "User comment 1", timestamp: "2024-01-01T00:00:00Z" },
    { stepNumber: 2, content: "User comment 2", timestamp: "2024-01-01T00:01:00Z" },
  ];

  const mockFeedbackSteps: FeedbackStep[] = [
    { stepNumber: 1, content: "Feedback 1", timestamp: "2024-01-01T00:00:30Z" },
    { stepNumber: 2, content: "Feedback 2", timestamp: "2024-01-01T00:01:30Z" },
  ];

  const mockProblemSteps: ProblemStatementStep[] = [
    { stepNumber: 1, content: "Design a URL shortener", timestamp: "2024-01-01T00:00:00Z" },
    { stepNumber: 2, content: "Now add rate limiting", timestamp: "2024-01-01T00:01:00Z" },
  ];

  describe("Initial state", () => {
    it("starts with problem tab active", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: [],
          feedbackSteps: [],
          problemSteps: [],
          currentComments: "",
        })
      );

      expect(result.current.activeCoachTab).toBe("problem");
    });

    it("starts viewing current step (null)", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: [],
          feedbackSteps: [],
          problemSteps: [],
          currentComments: "",
        })
      );

      expect(result.current.viewingStepNumber).toBeNull();
      expect(result.current.isViewingCurrent).toBe(true);
    });

    it("feedback tab is disabled when no feedback exists", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: [],
          feedbackSteps: [],
          problemSteps: [],
          currentComments: "",
        })
      );

      expect(result.current.isFeedbackTabEnabled).toBe(false);
    });
  });

  describe("Total rounds calculation", () => {
    it("calculates total rounds as comment steps + 1", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: [],
          problemSteps: [],
          currentComments: "Current comment",
        })
      );

      expect(result.current.totalRounds).toBe(3); // 2 historical + 1 current
    });

    it("returns 1 when no comment steps", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: [],
          feedbackSteps: [],
          problemSteps: [],
          currentComments: "Current comment",
        })
      );

      expect(result.current.totalRounds).toBe(1);
    });
  });

  describe("Feedback tab auto-switching", () => {
    it("auto-switches to feedback tab when first feedback arrives", () => {
      const { result, rerender } = renderHook(
        ({ feedbackSteps }: { feedbackSteps: FeedbackStep[] }) =>
          useUnifiedStepNavigation({
            commentSteps: [],
            feedbackSteps,
            problemSteps: [],
            currentComments: "",
          }),
        { initialProps: { feedbackSteps: [] as FeedbackStep[] } }
      );

      expect(result.current.activeCoachTab).toBe("problem");

      // Add feedback
      rerender({ feedbackSteps: mockFeedbackSteps });

      expect(result.current.activeCoachTab).toBe("feedback");
    });

    it("only auto-switches once (doesn't override manual selection)", () => {
      const { result, rerender } = renderHook(
        ({ feedbackSteps }: { feedbackSteps: FeedbackStep[] }) =>
          useUnifiedStepNavigation({
            commentSteps: [],
            feedbackSteps,
            problemSteps: [],
            currentComments: "",
          }),
        { initialProps: { feedbackSteps: [] as FeedbackStep[] } }
      );

      // Add feedback - should auto-switch
      rerender({ feedbackSteps: mockFeedbackSteps });
      expect(result.current.activeCoachTab).toBe("feedback");

      // Manually switch back to problem
      act(() => {
        result.current.setActiveCoachTab("problem");
      });
      expect(result.current.activeCoachTab).toBe("problem");

      // Add more feedback - should NOT auto-switch again
      rerender({
        feedbackSteps: [
          ...mockFeedbackSteps,
          { stepNumber: 3, content: "Feedback 3", timestamp: "2024-01-01T00:02:00Z" },
        ],
      });
      expect(result.current.activeCoachTab).toBe("problem");
    });
  });

  describe("Step 1 special behavior", () => {
    it("disables feedback tab when viewing step 1", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current comment",
        })
      );

      // Initially viewing current (step 3), feedback tab should be enabled
      expect(result.current.isFeedbackTabEnabled).toBe(true);

      // Navigate to step 1
      act(() => {
        result.current.selectStep(1);
      });

      expect(result.current.isFeedbackTabEnabled).toBe(false);
    });

    it("auto-switches to problem tab when viewing step 1", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current comment",
        })
      );

      // Manually set to feedback tab
      act(() => {
        result.current.setActiveCoachTab("feedback");
      });
      expect(result.current.activeCoachTab).toBe("feedback");

      // Navigate to step 1
      act(() => {
        result.current.selectStep(1);
      });

      // Should auto-switch to problem tab
      expect(result.current.activeCoachTab).toBe("problem");
    });

    it("enables feedback tab again when navigating away from step 1", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current comment",
        })
      );

      // Navigate to step 1
      act(() => {
        result.current.selectStep(1);
      });
      expect(result.current.isFeedbackTabEnabled).toBe(false);

      // Navigate to step 2
      act(() => {
        result.current.selectStep(2);
      });
      expect(result.current.isFeedbackTabEnabled).toBe(true);
    });
  });

  describe("Step navigation", () => {
    it("selects historical step", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current comment",
        })
      );

      act(() => {
        result.current.selectStep(1);
      });

      expect(result.current.viewingStepNumber).toBe(1);
      expect(result.current.isViewingCurrent).toBe(false);
    });

    it("resets to current when selecting step >= totalRounds", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current comment",
        })
      );

      // Navigate to historical step
      act(() => {
        result.current.selectStep(1);
      });
      expect(result.current.isViewingCurrent).toBe(false);

      // Select current step (totalRounds = 3)
      act(() => {
        result.current.selectStep(3);
      });
      expect(result.current.viewingStepNumber).toBeNull();
      expect(result.current.isViewingCurrent).toBe(true);
    });

    it("resets to current step with resetToCurrentStep", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current comment",
        })
      );

      act(() => {
        result.current.selectStep(1);
      });
      expect(result.current.isViewingCurrent).toBe(false);

      act(() => {
        result.current.resetToCurrentStep();
      });
      expect(result.current.viewingStepNumber).toBeNull();
      expect(result.current.isViewingCurrent).toBe(true);
    });
  });

  describe("Content derivation", () => {
    it("displays current comments when viewing current step", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "I'm working on this now",
        })
      );

      expect(result.current.displayedCommentContent).toBe("I'm working on this now");
    });

    it("displays historical comment when viewing past step", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current",
        })
      );

      act(() => {
        result.current.selectStep(1);
      });

      expect(result.current.displayedCommentContent).toBe("User comment 1");
    });

    it("displays latest feedback when viewing current step", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current",
        })
      );

      expect(result.current.displayedFeedbackContent).toContain("Feedback 2");
    });

    it("displays empty feedback for step 1", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current",
        })
      );

      act(() => {
        result.current.selectStep(1);
      });

      // Step 1 has no feedback (only problem statement)
      expect(result.current.displayedFeedbackContent).not.toContain("Feedback");
      expect(result.current.displayedFeedbackContent).toContain("Design a URL shortener");
    });

    it("appends next prompt to feedback content", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current",
        })
      );

      act(() => {
        result.current.selectStep(2);
      });

      // Should show feedback 1 + problem step 2 as "Next up"
      expect(result.current.displayedFeedbackContent).toContain("Feedback 1");
      expect(result.current.displayedFeedbackContent).toContain("**Next up:**");
      expect(result.current.displayedFeedbackContent).toContain("Now add rate limiting");
    });

    it("returns original problem statement", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: mockCommentSteps,
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "Current",
        })
      );

      expect(result.current.originalProblemStatement).toBe("Design a URL shortener");
    });

    it("handles empty feedback gracefully", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: [],
          feedbackSteps: [],
          problemSteps: [],
          currentComments: "Current",
        })
      );

      expect(result.current.displayedFeedbackContent).toBe("");
    });
  });

  describe("Tab state management", () => {
    it("allows manual tab switching", () => {
      const { result } = renderHook(() =>
        useUnifiedStepNavigation({
          commentSteps: [],
          feedbackSteps: mockFeedbackSteps,
          problemSteps: mockProblemSteps,
          currentComments: "",
        })
      );

      expect(result.current.activeCoachTab).toBe("feedback"); // Auto-switched

      act(() => {
        result.current.setActiveCoachTab("problem");
      });

      expect(result.current.activeCoachTab).toBe("problem");

      act(() => {
        result.current.setActiveCoachTab("feedback");
      });

      expect(result.current.activeCoachTab).toBe("feedback");
    });
  });
});
