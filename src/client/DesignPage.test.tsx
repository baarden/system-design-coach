import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock ExcalidrawClient BEFORE importing DesignPage
vi.mock("./components/ExcalidrawClient", async () => {
  const { MockExcalidrawClient } = await import("./test/mocks/ExcalidrawClient");
  return {
    ExcalidrawClient: MockExcalidrawClient,
  };
});

import DesignPage from "./DesignPage";
import {
  resetMockExcalidrawState,
  simulateWebSocketMessage,
  getMockApi,
} from "./test/mocks/ExcalidrawClient";

// Mock auth provider
vi.mock("./providers/auth", () => ({
  useAuth: () => ({
    userId: "test-user",
    reloadUser: vi.fn(),
  }),
  AuthUI: () => <div data-testid="auth-ui">Auth UI</div>,
  AuthMenuItems: () => <div data-testid="auth-menu-items">Auth Menu Items</div>,
  ENABLE_AUTH: false,
}));

// Mock ChatWidget to simplify tests
vi.mock("./components/ChatWidget", () => ({
  ChatWidget: () => <div data-testid="chat-widget">Chat Widget</div>,
}));

// Mock theme provider
vi.mock("./providers/theme", () => ({
  useTheme: () => ({
    mode: "light",
    toggleTheme: vi.fn(),
  }),
}));

function renderDesignPage(route = "/test-user/url-shortener") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/:user/:questionId" element={<DesignPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DesignPage", () => {
  beforeEach(() => {
    resetMockExcalidrawState();
    // Mark tutorial as seen to prevent dialog from blocking UI in tests
    localStorage.setItem('tutorial-seen', 'true');
  });

  describe("initial render", () => {
    it("renders the app title", async () => {
      renderDesignPage();

      expect(screen.getByText("System Design Coach")).toBeInTheDocument();
    });

    it("renders auth UI in header", async () => {
      renderDesignPage();

      expect(screen.getByTestId("auth-ui")).toBeInTheDocument();
    });

    it("renders ExcalidrawClient with correct props", async () => {
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-client")).toBeInTheDocument();
      });

      const client = screen.getByTestId("excalidraw-client");
      expect(client).toHaveAttribute("data-room-id", "test-user/url-shortener");
    });

    it("fetches and displays problem statement", async () => {
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByText(/URL shortening service/i)).toBeInTheDocument();
      });
    });

    it("shows connected status after ExcalidrawClient connects", async () => {
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });
    });

    it("renders the Get Feedback button", async () => {
      renderDesignPage();

      expect(screen.getByRole("button", { name: /get feedback/i })).toBeInTheDocument();
    });

    it("renders user comments text field", async () => {
      renderDesignPage();

      expect(
        screen.getByPlaceholderText(/add your notes and comments/i)
      ).toBeInTheDocument();
    });
  });

  describe("returns null for invalid routes", () => {
    it("returns null when roomId cannot be constructed", () => {
      const { container } = render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<DesignPage />} />
          </Routes>
        </MemoryRouter>
      );

      // DesignPage returns null when no user/questionId params
      expect(container.firstChild).toBeNull();
    });
  });

  describe("feedback flow", () => {
    it("shows loading state when requesting feedback", async () => {
      const user = userEvent.setup();
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-client")).toBeInTheDocument();
      });

      const feedbackButton = screen.getByRole("button", { name: /get feedback/i });
      await user.click(feedbackButton);

      expect(screen.getByText(/getting feedback/i)).toBeInTheDocument();
      expect(feedbackButton).toBeDisabled();
    });

    it("calls syncToBackend and send on Get Feedback click", async () => {
      const user = userEvent.setup();
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-client")).toBeInTheDocument();
      });

      const feedbackButton = screen.getByRole("button", { name: /get feedback/i });
      await user.click(feedbackButton);

      const api = getMockApi();
      expect(api?.syncToBackend).toHaveBeenCalled();
      expect(api?.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "get-feedback",
          userId: "test-user",
        })
      );
    });

    it("includes user comments in feedback request", async () => {
      const user = userEvent.setup();
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-client")).toBeInTheDocument();
      });

      // Type in user comments
      const commentsField = screen.getByPlaceholderText(/add your notes and comments/i);
      await user.type(commentsField, "My design notes");

      const feedbackButton = screen.getByRole("button", { name: /get feedback/i });
      await user.click(feedbackButton);

      const api = getMockApi();
      expect(api?.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userComments: "My design notes",
        })
      );
    });

    it("displays claude feedback when received", async () => {
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-client")).toBeInTheDocument();
      });

      // Simulate receiving feedback
      act(() => {
        simulateWebSocketMessage({
          type: "claude-feedback",
          responseText: "Great design! Consider adding caching.",
          timestamp: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/Great design/i)).toBeInTheDocument();
      });
    });

    it("clears user comments after receiving feedback", async () => {
      const user = userEvent.setup();
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-client")).toBeInTheDocument();
      });

      // Type in user comments
      const commentsField = screen.getByPlaceholderText(/add your notes and comments/i);
      await user.type(commentsField, "My design notes");

      // Simulate receiving feedback
      act(() => {
        simulateWebSocketMessage({
          type: "claude-feedback",
          responseText: "Great design!",
          timestamp: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(commentsField).toHaveValue("");
      });
    });
  });

  describe("WebSocket message handling", () => {
    it("updates problem statement on next-prompt message", async () => {
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-client")).toBeInTheDocument();
      });

      act(() => {
        simulateWebSocketMessage({
          type: "next-prompt",
          nextPrompt: "Now consider how to handle failures",
          timestamp: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/handle failures/i)).toBeInTheDocument();
      });
    });

    it("restores conversation on reconnect", async () => {
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-client")).toBeInTheDocument();
      });

      act(() => {
        simulateWebSocketMessage({
          type: "conversation_restore",
          latestFeedback: "Your previous design looked promising",
          timestamp: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/previous design/i)).toBeInTheDocument();
      });
    });
  });

  describe("error handling", () => {
    it("displays error message in snackbar", async () => {
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-client")).toBeInTheDocument();
      });

      // Simulate an error via status message
      act(() => {
        simulateWebSocketMessage({
          type: "payment-error",
          message: "Payment processing failed",
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/Payment processing failed/i)).toBeInTheDocument();
      });
    });
  });

  describe("resizable panels", () => {
    it("renders Claude Feedback panel", async () => {
      renderDesignPage();

      expect(screen.getByText("Claude Feedback")).toBeInTheDocument();
    });

    it("renders Problem Statement panel", async () => {
      renderDesignPage();

      expect(screen.getByText("Problem Statement")).toBeInTheDocument();
    });
  });

  describe("chat widget", () => {
    it("renders chat widget after API is ready", async () => {
      renderDesignPage();

      await waitFor(() => {
        expect(screen.getByTestId("chat-widget")).toBeInTheDocument();
      });
    });
  });

  describe("tutorial dialog", () => {
    it("shows tutorial dialog on first visit", async () => {
      localStorage.removeItem('tutorial-seen');
      renderDesignPage();

      expect(screen.getByRole("dialog", { name: /getting started/i })).toBeInTheDocument();
    });

    it("does not show tutorial dialog when already seen", async () => {
      localStorage.setItem('tutorial-seen', 'true');
      renderDesignPage();

      expect(screen.queryByRole("dialog", { name: /getting started/i })).not.toBeInTheDocument();
    });

    it("closes tutorial dialog and sets localStorage when clicking Got it", async () => {
      const user = userEvent.setup();
      localStorage.removeItem('tutorial-seen');
      renderDesignPage();

      expect(screen.getByRole("dialog", { name: /getting started/i })).toBeInTheDocument();

      const gotItButton = screen.getByRole("button", { name: /got it/i });
      await user.click(gotItButton);

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: /getting started/i })).not.toBeInTheDocument();
      });
      expect(localStorage.getItem('tutorial-seen')).toBe('true');
    });

    it("opens tutorial dialog when clicking info icon", async () => {
      const user = userEvent.setup();
      localStorage.setItem('tutorial-seen', 'true');
      renderDesignPage();

      expect(screen.queryByRole("dialog", { name: /getting started/i })).not.toBeInTheDocument();

      const infoButton = screen.getByRole("button", { name: /how to use/i });
      await user.click(infoButton);

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: /getting started/i })).toBeInTheDocument();
      });
    });
  });
});
