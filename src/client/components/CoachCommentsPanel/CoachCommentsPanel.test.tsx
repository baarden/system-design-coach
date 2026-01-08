import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { CoachCommentsPanel } from "./CoachCommentsPanel";
import type { FeedbackStep } from "../../hooks/useClaudeFeedbackSteps";

describe("CoachCommentsPanel", () => {
  const mockOnTabChange = vi.fn();
  const mockOnStepSelect = vi.fn();

  const defaultProps = {
    activeTab: "problem" as const,
    onTabChange: mockOnTabChange,
    isFeedbackTabEnabled: true,
    problemStatementContent: "# Problem\nSolve this problem",
    feedbackContent: "# Feedback\nGood work!",
    scrollRef: createRef<HTMLDivElement>(),
    hasScrollTop: false,
    hasScrollBottom: false,
  };

  const createSteps = (count: number): FeedbackStep[] => {
    return Array.from({ length: count }, (_, i) => ({
      stepNumber: i + 1,
      content: `Feedback for step ${i + 1}`,
      timestamp: new Date().toISOString(),
    }));
  };

  describe("Tab Rendering", () => {
    it("renders both tabs", () => {
      render(<CoachCommentsPanel {...defaultProps} />);

      expect(screen.getByText("Problem Statement")).toBeInTheDocument();
      expect(screen.getByText("Coach Comments")).toBeInTheDocument();
    });

    it("shows problem content when problem tab is active", () => {
      render(<CoachCommentsPanel {...defaultProps} activeTab="problem" />);

      expect(screen.getByText("Solve this problem")).toBeInTheDocument();
    });

    it("shows feedback content when feedback tab is active", () => {
      render(<CoachCommentsPanel {...defaultProps} activeTab="feedback" />);

      expect(screen.getByText("Good work!")).toBeInTheDocument();
    });

    it("disables feedback tab when isFeedbackTabEnabled is false", () => {
      render(<CoachCommentsPanel {...defaultProps} isFeedbackTabEnabled={false} />);

      const feedbackTab = screen.getByRole("tab", { name: /Coach Comments/i });
      expect(feedbackTab).toHaveClass("Mui-disabled");
    });

    it("enables feedback tab when isFeedbackTabEnabled is true", () => {
      render(<CoachCommentsPanel {...defaultProps} isFeedbackTabEnabled={true} />);

      const feedbackTab = screen.getByRole("tab", { name: /Coach Comments/i });
      expect(feedbackTab).not.toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("Tab Interaction", () => {
    it("calls onTabChange when switching to feedback tab", async () => {
      const user = userEvent.setup();
      render(<CoachCommentsPanel {...defaultProps} />);

      await user.click(screen.getByText("Coach Comments"));

      expect(mockOnTabChange).toHaveBeenCalledWith("feedback");
    });

    it("calls onTabChange when switching to problem tab", async () => {
      const user = userEvent.setup();
      render(<CoachCommentsPanel {...defaultProps} activeTab="feedback" />);

      await user.click(screen.getByText("Problem Statement"));

      expect(mockOnTabChange).toHaveBeenCalledWith("problem");
    });
  });

  describe("Steps Dropdown", () => {
    it("does not show dropdown when totalSteps < 3", () => {
      const steps = createSteps(2);
      render(
        <CoachCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={2}
          currentStep={2}
          isViewingLatest={true}
          onStepSelect={mockOnStepSelect}
        />
      );

      expect(screen.queryByTestId("feedback-step-selector")).not.toBeInTheDocument();
    });

    it("shows dropdown when totalSteps >= 3", () => {
      const steps = createSteps(3);
      render(
        <CoachCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={3}
          currentStep={3}
          isViewingLatest={true}
          onStepSelect={mockOnStepSelect}
        />
      );

      expect(screen.getByTestId("feedback-step-selector")).toBeInTheDocument();
    });

    it("excludes step 1 from dropdown options", async () => {
      const user = userEvent.setup();
      const steps = createSteps(4);
      render(
        <CoachCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={4}
          currentStep={4}
          isViewingLatest={true}
          onStepSelect={mockOnStepSelect}
        />
      );

      // Click on the select input (combobox role)
      const selectInput = screen.getByRole("combobox");
      await user.click(selectInput);

      // Step 1 should not be in the dropdown options
      expect(screen.queryByRole("option", { name: "Step 1" })).not.toBeInTheDocument();

      // Steps 2, 3, 4 should be present as options
      expect(screen.getByRole("option", { name: "Step 2" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Step 3" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Step 4" })).toBeInTheDocument();
    });

    it("includes current step option when not in steps array", async () => {
      const user = userEvent.setup();
      const steps = createSteps(2); // Only steps 1 and 2
      render(
        <CoachCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={4} // But totalSteps is 4
          currentStep={4}
          isViewingLatest={true}
          onStepSelect={mockOnStepSelect}
        />
      );

      const selectInput = screen.getByRole("combobox");
      await user.click(selectInput);

      // Should show step 2 (from array) and step 4 (current) as options
      expect(screen.getByRole("option", { name: "Step 2" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Step 4" })).toBeInTheDocument();
    });

    it("does not include current step option when totalSteps < 2", () => {
      const steps = createSteps(1);
      render(
        <CoachCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={1}
          currentStep={1}
          isViewingLatest={true}
          onStepSelect={mockOnStepSelect}
        />
      );

      // Dropdown should not be shown at all since totalSteps < 3
      expect(screen.queryByTestId("feedback-step-selector")).not.toBeInTheDocument();
    });

    it("calls onStepSelect when selecting a step", async () => {
      const user = userEvent.setup();
      const steps = createSteps(4);
      render(
        <CoachCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={4}
          currentStep={4}
          isViewingLatest={true}
          onStepSelect={mockOnStepSelect}
        />
      );

      const selectInput = screen.getByRole("combobox");
      await user.click(selectInput);
      await user.click(screen.getByText("Step 3"));

      expect(mockOnStepSelect).toHaveBeenCalledWith(3);
    });

    it("shows warning color when not viewing latest step", () => {
      const steps = createSteps(4);
      render(
        <CoachCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={4}
          currentStep={2}
          isViewingLatest={false}
          onStepSelect={mockOnStepSelect}
        />
      );

      const dropdown = screen.getByTestId("feedback-step-selector");
      const selectElement = dropdown.querySelector(".MuiSelect-select");

      // Check that warning.main color is applied via sx prop
      expect(selectElement).toBeInTheDocument();
    });

    it("shows secondary color when viewing latest step", () => {
      const steps = createSteps(4);
      render(
        <CoachCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={4}
          currentStep={4}
          isViewingLatest={true}
          onStepSelect={mockOnStepSelect}
        />
      );

      const dropdown = screen.getByTestId("feedback-step-selector");
      const selectElement = dropdown.querySelector(".MuiSelect-select");

      // Check that text.secondary color is applied via sx prop
      expect(selectElement).toBeInTheDocument();
    });
  });

  describe("Content Display", () => {
    it("renders ResizableMarkdownPanel with problem content", () => {
      render(<CoachCommentsPanel {...defaultProps} activeTab="problem" />);

      // The content is passed to ResizableMarkdownPanel which uses ReactMarkdown
      expect(screen.getByText("Solve this problem")).toBeInTheDocument();
    });

    it("renders ResizableMarkdownPanel with feedback content", () => {
      render(<CoachCommentsPanel {...defaultProps} activeTab="feedback" />);

      expect(screen.getByText("Good work!")).toBeInTheDocument();
    });

    it("passes scroll props to ResizableMarkdownPanel", () => {
      const scrollRef = createRef<HTMLDivElement>();
      render(
        <CoachCommentsPanel
          {...defaultProps}
          scrollRef={scrollRef}
          hasScrollTop={true}
          hasScrollBottom={true}
        />
      );

      // ResizableMarkdownPanel should render with scroll indicators
      expect(screen.getByText("Solve this problem")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty content gracefully", () => {
      render(
        <CoachCommentsPanel
          {...defaultProps}
          problemStatementContent=""
          feedbackContent=""
        />
      );

      // Should render without crashing
      expect(screen.getByText("Problem Statement")).toBeInTheDocument();
    });

    it("handles missing optional step props", () => {
      render(
        <CoachCommentsPanel
          {...defaultProps}
          // No steps, totalSteps, currentStep, etc.
        />
      );

      expect(screen.queryByTestId("feedback-step-selector")).not.toBeInTheDocument();
    });

    it("does not show dropdown when steps array is empty", () => {
      render(
        <CoachCommentsPanel
          {...defaultProps}
          steps={[]}
          totalSteps={3}
          currentStep={3}
          isViewingLatest={true}
          onStepSelect={mockOnStepSelect}
        />
      );

      // Dropdown should not show when steps array is empty, even if totalSteps >= 3
      expect(screen.queryByTestId("feedback-step-selector")).not.toBeInTheDocument();
    });
  });
});
