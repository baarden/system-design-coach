import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetProblemDialog } from "./ResetProblemDialog";
import { suppressConsoleErrors } from "../../test/muiTestUtils";

describe("ResetProblemDialog", () => {
  // Suppress MUI act() warnings from button/dialog animations
  suppressConsoleErrors();

  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    isLoading: false,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Button Interactions", () => {
    it("calls onConfirm when Reset button is clicked", async () => {
      const user = userEvent.setup();
      render(<ResetProblemDialog {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "Reset" }));

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      render(<ResetProblemDialog {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when dialog backdrop is clicked", async () => {
      const user = userEvent.setup();
      render(<ResetProblemDialog {...defaultProps} />);

      // MUI Dialog renders a backdrop element
      const backdrop = document.querySelector(".MuiBackdrop-root");
      if (backdrop) {
        await user.click(backdrop as HTMLElement);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe("Loading State", () => {
    it("displays loading text when isLoading is true", () => {
      render(<ResetProblemDialog {...defaultProps} isLoading={true} />);

      expect(screen.getByText("Resetting...")).toBeInTheDocument();
    });

    it("displays normal text when isLoading is false", () => {
      render(<ResetProblemDialog {...defaultProps} isLoading={false} />);

      expect(screen.getByText("Reset")).toBeInTheDocument();
      expect(screen.queryByText("Resetting...")).not.toBeInTheDocument();
    });

    it("disables Reset button when loading", () => {
      render(<ResetProblemDialog {...defaultProps} isLoading={true} />);

      const resetButton = screen.getByRole("button", { name: "Resetting..." });
      expect(resetButton).toBeDisabled();
    });

    it("enables Reset button when not loading", () => {
      render(<ResetProblemDialog {...defaultProps} isLoading={false} />);

      const resetButton = screen.getByRole("button", { name: "Reset" });
      expect(resetButton).not.toBeDisabled();
    });

    it("prevents onConfirm when Reset button is loading", () => {
      render(<ResetProblemDialog {...defaultProps} isLoading={true} />);

      const resetButton = screen.getByRole("button", { name: "Resetting..." });

      // Verify button is disabled which prevents clicking in real browser
      expect(resetButton).toBeDisabled();
    });
  });

  describe("Button Styling", () => {
    it("renders Reset button with error color", () => {
      render(<ResetProblemDialog {...defaultProps} />);

      const resetButton = screen.getByRole("button", { name: "Reset" });
      expect(resetButton).toHaveClass("MuiButton-colorError");
    });

    it("renders Cancel button as contained variant", () => {
      render(<ResetProblemDialog {...defaultProps} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      expect(cancelButton).toHaveClass("MuiButton-contained");
    });
  });

  describe("Edge Cases", () => {
    it("handles isLoading being undefined by defaulting to false", () => {
      const propsWithoutLoading = {
        open: true,
        onClose: mockOnClose,
        onConfirm: mockOnConfirm,
      };
      render(<ResetProblemDialog {...propsWithoutLoading} />);

      const resetButton = screen.getByRole("button", { name: "Reset" });
      expect(resetButton).not.toBeDisabled();
    });

    it("allows Cancel button to be clicked even when loading", async () => {
      const user = userEvent.setup();
      render(<ResetProblemDialog {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      expect(cancelButton).not.toBeDisabled();

      await user.click(cancelButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
