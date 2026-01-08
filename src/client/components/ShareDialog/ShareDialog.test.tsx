import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareDialog } from "./ShareDialog";
import * as api from "../../api";
import { suppressConsoleErrors } from "../../test/muiTestUtils";

// Mock the API module
vi.mock("../../api", () => ({
  getRoom: vi.fn(),
  regenerateToken: vi.fn(),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe("ShareDialog", () => {
  // Suppress MUI warnings and expected error logging from error handling tests
  suppressConsoleErrors([
    'Error fetching share URL',
    'Error regenerating token',
    'Failed to copy',
  ]);

  const mockOnClose = vi.fn();
  const mockOnKeepAliveChange = vi.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    roomId: "user123/problem456",
  };

  const mockRoomResponse: api.RoomResponse = {
    success: true,
    room: {
      roomId: "user123/problem456",
      problemId: "problem456",
      shareUrl: "http://server.example.com/guest/abc123",
    },
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Set default mock implementations
    vi.mocked(api.getRoom).mockResolvedValue(mockRoomResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering and Initial Load", () => {
    it("renders when open is true", async () => {
      render(<ShareDialog {...defaultProps} />);

      expect(screen.getByText("Share Room")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText(/Share this link with others/)).toBeInTheDocument();
      });
    });

    it("does not render when open is false", () => {
      render(<ShareDialog {...defaultProps} open={false} />);

      expect(screen.queryByText("Share Room")).not.toBeInTheDocument();
    });

    it("shows loading state initially", async () => {
      render(<ShareDialog {...defaultProps} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      // Wait for async operation to complete to avoid act() warnings
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
    });

    it("fetches room data when dialog opens", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(api.getRoom).toHaveBeenCalledWith("user123/problem456");
      });
    });

    it("displays share URL after loading", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        const input = screen.getByDisplayValue(/\/guest\/abc123$/);
        expect(input).toBeInTheDocument();
      });
    });

    it("replaces server origin with client origin in URL", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        const expectedUrl = `${window.location.origin}/guest/abc123`;
        expect(screen.getByDisplayValue(expectedUrl)).toBeInTheDocument();
      });
    });

    it("does not fetch data when roomId is not provided", () => {
      render(<ShareDialog {...defaultProps} roomId="" />);

      expect(api.getRoom).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("displays error when getRoom returns error", async () => {
      const errorResponse = {
        success: false,
        error: "Room not found",
      };
      vi.mocked(api.getRoom).mockResolvedValue(errorResponse);

      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Room not found")).toBeInTheDocument();
      });
    });

    it("displays generic error when getRoom returns success but no shareUrl", async () => {
      const invalidResponse: api.RoomResponse = {
        success: true,
        room: {
          roomId: "user123/problem456",
          problemId: "problem456",
          // shareUrl is intentionally missing to test the error case
        },
      };
      vi.mocked(api.getRoom).mockResolvedValue(invalidResponse);

      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to get share URL")).toBeInTheDocument();
      });
    });

    it("displays error when getRoom throws exception", async () => {
      vi.mocked(api.getRoom).mockRejectedValue(new Error("Network error"));

      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load share URL")).toBeInTheDocument();
      });
    });

    it("displays error when regenerateToken fails", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue(/\/guest\/abc123$/)).toBeInTheDocument();
      });

      vi.mocked(api.regenerateToken).mockResolvedValue({
        success: false,
        error: "Failed to regenerate",
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Regenerate Link/i }));

      await waitFor(() => {
        expect(screen.getByText("Failed to regenerate")).toBeInTheDocument();
      });
    });
  });

  describe("Copy to Clipboard", () => {
    it("renders copy button", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        const copyButton = screen.getByRole("button", { name: /Copy to clipboard/i });
        expect(copyButton).toBeInTheDocument();
      });
    });

    it("has copy button that can be clicked", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue(/\/guest\/abc123$/)).toBeInTheDocument();
      });

      // Verify copy button exists (icon button with ContentCopyIcon)
      const buttons = screen.getAllByRole("button");
      const copyButton = buttons.find(btn => btn.querySelector('svg'));
      expect(copyButton).toBeInTheDocument();
    });

    it("shows success message after copying", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue(/\/guest\/abc123$/)).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const copyButton = screen.getByRole("button", { name: /Copy to clipboard/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText("Link copied to clipboard!")).toBeInTheDocument();
      });
    });
  });

  describe("Regenerate Link", () => {
    it("renders regenerate button", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Regenerate Link/i })).toBeInTheDocument();
      });
    });

    it("calls regenerateToken API when regenerate button is clicked", async () => {
      vi.mocked(api.regenerateToken).mockResolvedValue({
        success: true,
        shareUrl: "http://server.example.com/guest/xyz789",
      });

      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue(/\/guest\/abc123$/)).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Regenerate Link/i }));

      await waitFor(() => {
        expect(api.regenerateToken).toHaveBeenCalledWith("user123/problem456");
      });
    });

    it("updates share URL after successful regeneration", async () => {
      vi.mocked(api.regenerateToken).mockResolvedValue({
        success: true,
        shareUrl: "http://server.example.com/guest/xyz789",
      });

      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue(/\/guest\/abc123$/)).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Regenerate Link/i }));

      await waitFor(() => {
        const expectedUrl = `${window.location.origin}/guest/xyz789`;
        expect(screen.getByDisplayValue(expectedUrl)).toBeInTheDocument();
      });
    });

    it("shows loading state while regenerating", async () => {
      vi.mocked(api.regenerateToken).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Regenerate Link/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Regenerate Link/i }));

      await waitFor(() => {
        expect(screen.getByText("Regenerating...")).toBeInTheDocument();
      });
    });

    it("disables regenerate button while regenerating", async () => {
      vi.mocked(api.regenerateToken).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Regenerate Link/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const regenerateButton = screen.getByRole("button", { name: /Regenerate Link/i });
      await user.click(regenerateButton);

      await waitFor(() => {
        const disabledButton = screen.getByRole("button", { name: /Regenerating.../i });
        expect(disabledButton).toBeDisabled();
      });
    });
  });

  describe("Keep Alive Toggle", () => {
    it("renders keep alive toggle when onKeepAliveChange is provided", async () => {
      render(<ShareDialog {...defaultProps} onKeepAliveChange={mockOnKeepAliveChange} />);

      await waitFor(() => {
        expect(screen.getByText("Keep connection alive")).toBeInTheDocument();
      });
    });

    it("does not render keep alive toggle when onKeepAliveChange is not provided", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Keep connection alive")).not.toBeInTheDocument();
      });
    });

    it("renders toggle with accompanying description text", async () => {
      render(
        <ShareDialog
          {...defaultProps}
          keepAlive={true}
          onKeepAliveChange={mockOnKeepAliveChange}
        />
      );

      // Wait for dialog to finish loading
      await waitFor(() => {
        expect(screen.getByDisplayValue(/\/guest\/abc123$/)).toBeInTheDocument();
      });

      // Verify toggle and description are rendered
      expect(screen.getByText("Keep connection alive")).toBeInTheDocument();
      expect(screen.getByText(/Stay connected while waiting for collaborators/i)).toBeInTheDocument();
    });
  });

  describe("Dialog Actions", () => {
    it("renders close button", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
      });
    });

    it("calls onClose when close button is clicked", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when dialog backdrop is clicked", async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Share Room")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const backdrop = document.querySelector(".MuiBackdrop-root");
      if (backdrop) {
        await user.click(backdrop as HTMLElement);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe("Edge Cases", () => {

    it("refetches data when dialog is reopened", async () => {
      const { rerender } = render(<ShareDialog {...defaultProps} open={false} />);

      expect(api.getRoom).not.toHaveBeenCalled();

      rerender(<ShareDialog {...defaultProps} open={true} />);

      await waitFor(() => {
        expect(api.getRoom).toHaveBeenCalledTimes(1);
      });
    });

    it("refetches data when roomId changes", async () => {
      const { rerender } = render(<ShareDialog {...defaultProps} roomId="room1" />);

      await waitFor(() => {
        expect(api.getRoom).toHaveBeenCalledWith("room1");
      });

      vi.clearAllMocks();

      rerender(<ShareDialog {...defaultProps} roomId="room2" />);

      await waitFor(() => {
        expect(api.getRoom).toHaveBeenCalledWith("room2");
      });
    });
  });
});
