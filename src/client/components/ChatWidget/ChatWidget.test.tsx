import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatWidget from "./ChatWidget";

// Mock react-chatbot-kit since it has complex internal state
vi.mock("react-chatbot-kit", () => ({
  default: ({ placeholderText }: { placeholderText: string }) => (
    <div data-testid="chatbot-mock">
      <input placeholder={placeholderText} data-testid="chat-input" />
    </div>
  ),
  createChatBotMessage: (text: string) => ({
    message: text,
    type: "bot",
    id: Math.random(),
  }),
}));

// Mock theme provider
vi.mock("../../providers/theme", () => ({
  useTheme: () => ({
    mode: "light",
    toggleTheme: vi.fn(),
  }),
}));

describe("ChatWidget", () => {
  const mockSendMessage = vi.fn();
  const mockOnNeedsCredits = vi.fn();
  const mockOnMessageConsumed = vi.fn();
  const mockOnUnavailable = vi.fn();

  const defaultProps = {
    sendMessage: mockSendMessage,
    userId: "test-user",
    onNeedsCredits: mockOnNeedsCredits,
    incomingMessage: null,
    onMessageConsumed: mockOnMessageConsumed,
    onUnavailable: mockOnUnavailable,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("FAB and toggle behavior", () => {
    it("renders closed by default with FAB visible", () => {
      render(<ChatWidget {...defaultProps} />);

      expect(screen.getByLabelText("chat")).toBeInTheDocument();
    });

    it("opens chat panel when FAB is clicked", async () => {
      const user = userEvent.setup();
      render(<ChatWidget {...defaultProps} />);

      await user.click(screen.getByLabelText("chat"));

      expect(screen.getByText("System Design Assistant")).toBeInTheDocument();
      expect(screen.getByTestId("chatbot-mock")).toBeInTheDocument();
    });

    it("hides FAB when chat is open", async () => {
      const user = userEvent.setup();
      render(<ChatWidget {...defaultProps} />);

      await user.click(screen.getByLabelText("chat"));

      expect(screen.queryByLabelText("chat")).not.toBeInTheDocument();
    });

    it("closes chat panel when close button is clicked", async () => {
      const user = userEvent.setup();
      render(<ChatWidget {...defaultProps} />);

      // Open chat
      await user.click(screen.getByLabelText("chat"));
      expect(screen.getByText("System Design Assistant")).toBeInTheDocument();

      // Close chat
      const closeButton = screen.getByRole("button", { name: "" }); // Close icon button
      await user.click(closeButton);

      // FAB should be visible again
      expect(screen.getByLabelText("chat")).toBeInTheDocument();
    });
  });

  describe("incoming message handling", () => {
    it("calls onMessageConsumed for chat-history messages", async () => {
      const { rerender } = render(<ChatWidget {...defaultProps} />);

      rerender(
        <ChatWidget
          {...defaultProps}
          incomingMessage={{
            type: "chat-history",
            messages: [
              { role: "assistant", content: "Hello", timestamp: "123", source: "chat" },
            ],
          }}
        />
      );

      await waitFor(() => {
        expect(mockOnMessageConsumed).toHaveBeenCalled();
      });
    });

    it("calls onMessageConsumed for chat-response messages", async () => {
      const { rerender } = render(<ChatWidget {...defaultProps} />);

      rerender(
        <ChatWidget
          {...defaultProps}
          incomingMessage={{
            type: "chat-response",
            message: "Hello from Claude",
          }}
        />
      );

      await waitFor(() => {
        expect(mockOnMessageConsumed).toHaveBeenCalled();
      });
    });

    it("processes status messages without throwing", async () => {
      const { rerender } = render(<ChatWidget {...defaultProps} />);

      // Status messages are only fully processed when pendingEventIdRef matches.
      // This test ensures the component doesn't crash when receiving status messages.
      // Full needsCredits flow is tested in integration tests.
      expect(() => {
        rerender(
          <ChatWidget
            {...defaultProps}
            incomingMessage={{
              type: "status",
              eventId: "chat-123",
              status: "error",
              needsCredits: true,
              message: "Out of credits",
            }}
          />
        );
      }).not.toThrow();
    });
  });

  describe("chat panel content", () => {
    it("displays header with title", async () => {
      const user = userEvent.setup();
      render(<ChatWidget {...defaultProps} />);

      await user.click(screen.getByLabelText("chat"));

      expect(screen.getByText("System Design Assistant")).toBeInTheDocument();
    });

    it("renders chatbot with correct placeholder", async () => {
      const user = userEvent.setup();
      render(<ChatWidget {...defaultProps} />);

      await user.click(screen.getByLabelText("chat"));

      expect(screen.getByPlaceholderText("Ask a question...")).toBeInTheDocument();
    });
  });
});
