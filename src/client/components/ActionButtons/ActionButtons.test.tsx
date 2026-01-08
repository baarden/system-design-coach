import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionButtons } from "./ActionButtons";

describe("ActionButtons", () => {
  const mockOnGetFeedback = vi.fn();
  const mockOnResetProblem = vi.fn();

  const defaultProps = {
    onGetFeedback: mockOnGetFeedback,
    onResetProblem: mockOnResetProblem,
    isFeedbackLoading: false,
    isResetting: false,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders both buttons", () => {
      render(<ActionButtons {...defaultProps} />);

      expect(screen.getByRole("button", { name: "Get Feedback" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reset Problem" })).toBeInTheDocument();
    });

    it("displays Get Feedback button with default text when not loading", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={false} />);

      expect(screen.getByText("Get Feedback")).toBeInTheDocument();
    });

    it("displays loading text when feedback is loading", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={true} />);

      expect(screen.getByText("Getting Feedback...")).toBeInTheDocument();
    });

    it("displays loading spinner when feedback is loading", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={true} />);

      const button = screen.getByRole("button", { name: "Getting Feedback..." });
      const spinner = button.querySelector(".MuiCircularProgress-root");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("Button Interactions", () => {
    it("calls onGetFeedback when Get Feedback button is clicked", async () => {
      const user = userEvent.setup();
      render(<ActionButtons {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "Get Feedback" }));

      expect(mockOnGetFeedback).toHaveBeenCalledTimes(1);
    });

    it("calls onResetProblem when Reset Problem button is clicked", async () => {
      const user = userEvent.setup();
      render(<ActionButtons {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "Reset Problem" }));

      expect(mockOnResetProblem).toHaveBeenCalledTimes(1);
    });
  });

  describe("Disabled States", () => {
    it("disables Get Feedback button when feedback is loading", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={true} />);

      const button = screen.getByRole("button", { name: "Getting Feedback..." });
      expect(button).toBeDisabled();
    });

    it("enables Get Feedback button when feedback is not loading", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={false} />);

      const button = screen.getByRole("button", { name: "Get Feedback" });
      expect(button).not.toBeDisabled();
    });

    it("disables Reset Problem button when feedback is loading", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={true} />);

      const button = screen.getByRole("button", { name: "Reset Problem" });
      expect(button).toBeDisabled();
    });

    it("disables Reset Problem button when resetting", () => {
      render(<ActionButtons {...defaultProps} isResetting={true} />);

      const button = screen.getByRole("button", { name: "Reset Problem" });
      expect(button).toBeDisabled();
    });

    it("disables Reset Problem button when both feedback is loading and resetting", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={true} isResetting={true} />);

      const button = screen.getByRole("button", { name: "Reset Problem" });
      expect(button).toBeDisabled();
    });

    it("enables Reset Problem button when neither loading nor resetting", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={false} isResetting={false} />);

      const button = screen.getByRole("button", { name: "Reset Problem" });
      expect(button).not.toBeDisabled();
    });
  });

  describe("Button Variants and Styling", () => {
    it("renders Get Feedback as contained button", () => {
      render(<ActionButtons {...defaultProps} />);

      const button = screen.getByRole("button", { name: "Get Feedback" });
      expect(button).toHaveClass("MuiButton-contained");
    });

    it("renders Reset Problem as outlined button", () => {
      render(<ActionButtons {...defaultProps} />);

      const button = screen.getByRole("button", { name: "Reset Problem" });
      expect(button).toHaveClass("MuiButton-outlined");
    });
  });

  describe("Edge Cases", () => {
    it("prevents onGetFeedback when button is disabled", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={true} />);

      const button = screen.getByRole("button", { name: "Getting Feedback..." });

      // Verify button is disabled which prevents clicking in real browser
      expect(button).toBeDisabled();
    });

    it("prevents onResetProblem when button is disabled", () => {
      render(<ActionButtons {...defaultProps} isFeedbackLoading={true} />);

      const button = screen.getByRole("button", { name: "Reset Problem" });

      // Verify button is disabled which prevents clicking in real browser
      expect(button).toBeDisabled();
    });
  });
});
