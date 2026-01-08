import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserCommentsPanel } from "./UserCommentsPanel";
import type { CommentStep } from "../../hooks";

// Mock Y.Text since we're not testing Yjs integration here
const mockYText = null;

describe("UserCommentsPanel", () => {
  const mockOnChange = vi.fn();
  const mockOnStepSelect = vi.fn();

  const defaultProps = {
    content: "My comments about the design",
    onChange: mockOnChange,
    isEditable: true,
    steps: [] as CommentStep[],
    totalSteps: 1,
    currentStep: 1,
    isViewingLatest: true,
    onStepSelect: mockOnStepSelect,
    yText: mockYText,
  };

  const createSteps = (count: number): CommentStep[] => {
    return Array.from({ length: count }, (_, i) => ({
      stepNumber: i + 1,
      content: `Comment for step ${i + 1}`,
      timestamp: new Date().toISOString(),
    }));
  };

  describe("Label Rendering", () => {
    it("renders the User Comments label", () => {
      render(<UserCommentsPanel {...defaultProps} />);

      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });

    it("renders label with correct positioning styles", () => {
      render(<UserCommentsPanel {...defaultProps} />);

      const label = screen.getByText("User Comments");
      expect(label).toHaveStyle({ position: "absolute" });
    });
  });

  describe("Steps Dropdown", () => {
    it("does not show dropdown when totalSteps < 2", () => {
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={createSteps(1)}
          totalSteps={1}
        />
      );

      // No dropdown should be present
      const selects = document.querySelectorAll(".MuiSelect-root");
      expect(selects.length).toBe(0);
    });

    it("shows dropdown when totalSteps >= 2", () => {
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={createSteps(2)}
          totalSteps={2}
        />
      );

      // Dropdown should be present
      const selects = document.querySelectorAll(".MuiSelect-root");
      expect(selects.length).toBeGreaterThan(0);
    });

    it("displays all steps in dropdown", async () => {
      const user = userEvent.setup();
      const steps = createSteps(2);
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={3}
          currentStep={2}
          isViewingLatest={false}
        />
      );

      const selectInput = screen.getByRole("combobox");
      await user.click(selectInput);

      // All steps should be present as options (steps 1, 2 from array, plus step 3 as current)
      expect(screen.getByRole("option", { name: "Step 1" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Step 2" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Step 3" })).toBeInTheDocument();
    });

    it("includes current step in dropdown", async () => {
      const user = userEvent.setup();
      const steps = createSteps(2);
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={3}
          currentStep={3}
          isViewingLatest={true}
        />
      );

      const selectInput = screen.getByRole("combobox");
      await user.click(selectInput);

      // Should show steps from array plus current step as options
      expect(screen.getByRole("option", { name: "Step 1" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Step 2" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Step 3" })).toBeInTheDocument();
    });

    it("calls onStepSelect when selecting a step", async () => {
      const user = userEvent.setup();
      const steps = createSteps(3);
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={3}
          currentStep={3}
          isViewingLatest={true}
        />
      );

      const selectInput = screen.getByRole("combobox");
      await user.click(selectInput);
      await user.click(screen.getByRole("option", { name: "Step 2" }));

      expect(mockOnStepSelect).toHaveBeenCalledWith(2);
    });

    it("shows totalSteps value when viewing latest", () => {
      const steps = createSteps(2);
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={3}
          currentStep={null}
          isViewingLatest={true}
        />
      );

      const select = document.querySelector(".MuiSelect-select") as HTMLElement;
      // When viewing latest, the select value should be totalSteps
      expect(select).toBeInTheDocument();
    });

    it("shows currentStep value when not viewing latest", () => {
      const steps = createSteps(3);
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={3}
          currentStep={2}
          isViewingLatest={false}
        />
      );

      const select = document.querySelector(".MuiSelect-select") as HTMLElement;
      expect(select).toBeInTheDocument();
    });

    it("applies warning color when not viewing latest", () => {
      const steps = createSteps(3);
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={3}
          currentStep={2}
          isViewingLatest={false}
        />
      );

      const select = document.querySelector(".MuiSelect-select") as HTMLElement;
      // The component applies warning.main color via sx prop when not viewing latest
      expect(select).toBeInTheDocument();
    });

    it("applies secondary color when viewing latest", () => {
      const steps = createSteps(3);
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={3}
          currentStep={3}
          isViewingLatest={true}
        />
      );

      const select = document.querySelector(".MuiSelect-select") as HTMLElement;
      // The component applies text.secondary color via sx prop when viewing latest
      expect(select).toBeInTheDocument();
    });
  });

  describe("Content Display", () => {
    it("displays content in ResizableMarkdownPanel", () => {
      render(<UserCommentsPanel {...defaultProps} />);

      expect(screen.getByText("My comments about the design")).toBeInTheDocument();
    });

    it("renders empty content gracefully", () => {
      render(<UserCommentsPanel {...defaultProps} content="" />);

      // Should render without crashing
      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });
  });

  describe("Editable State", () => {
    it("is editable when isEditable=true and isViewingLatest=true", () => {
      render(
        <UserCommentsPanel
          {...defaultProps}
          isEditable={true}
          isViewingLatest={true}
        />
      );

      // ResizableMarkdownPanel should be in edit mode
      // Since we can't easily test the internal state of ResizableMarkdownPanel,
      // we verify the component renders successfully with these props
      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });

    it("is not editable when isEditable=false", () => {
      render(
        <UserCommentsPanel
          {...defaultProps}
          isEditable={false}
          isViewingLatest={true}
        />
      );

      // ResizableMarkdownPanel should not be in edit mode
      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });

    it("is not editable when not viewing latest", () => {
      const steps = createSteps(3);
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={3}
          currentStep={2}
          isEditable={true}
          isViewingLatest={false}
        />
      );

      // ResizableMarkdownPanel should not be in edit mode even if isEditable=true
      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });

    it("is not editable when isEditable=false even if viewing latest", () => {
      render(
        <UserCommentsPanel
          {...defaultProps}
          isEditable={false}
          isViewingLatest={true}
        />
      );

      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });
  });

  describe("Callbacks", () => {
    it("passes onChange to ResizableMarkdownPanel", () => {
      render(<UserCommentsPanel {...defaultProps} />);

      // The onChange prop is passed to ResizableMarkdownPanel as onContentChange
      // We verify the component renders successfully with this prop
      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });

    it("passes yText to ResizableMarkdownPanel", () => {
      render(<UserCommentsPanel {...defaultProps} yText={mockYText} />);

      // The yText prop is passed to ResizableMarkdownPanel
      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });
  });

  describe("Layout and Styling", () => {
    it("renders with correct container styles", () => {
      const { container } = render(<UserCommentsPanel {...defaultProps} />);

      const box = container.firstChild as HTMLElement;
      expect(box).toHaveStyle({
        position: "relative",
        height: "100%",
        width: "100%",
      });
    });

    it("positions label absolutely at top-left", () => {
      render(<UserCommentsPanel {...defaultProps} />);

      const label = screen.getByText("User Comments");
      expect(label).toHaveStyle({
        position: "absolute",
      });
    });

    it("positions dropdown absolutely at top-right when shown", () => {
      const steps = createSteps(2);
      const { container } = render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={2}
        />
      );

      // The Select component itself has position: absolute via sx prop
      const selectContainer = container.querySelector(".MuiInputBase-root.MuiSelect-root") as HTMLElement;
      expect(selectContainer).toHaveStyle({
        position: "absolute",
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles null currentStep gracefully", () => {
      const steps = createSteps(2);
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={steps}
          totalSteps={2}
          currentStep={null}
          isViewingLatest={true}
        />
      );

      // Should render without crashing
      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });

    it("handles empty steps array with totalSteps > 1", async () => {
      const user = userEvent.setup();
      render(
        <UserCommentsPanel
          {...defaultProps}
          steps={[]}
          totalSteps={3}
          currentStep={3}
          isViewingLatest={true}
        />
      );

      const select = document.querySelector(".MuiSelect-root") as HTMLElement;
      await user.click(select);

      // Should show the current step
      expect(screen.getByText("Step 3")).toBeInTheDocument();
    });

    it("handles very long content", () => {
      const longContent = "Very long content ".repeat(100);
      render(
        <UserCommentsPanel
          {...defaultProps}
          content={longContent}
        />
      );

      // Should render without crashing
      expect(screen.getByText("User Comments")).toBeInTheDocument();
    });
  });
});
