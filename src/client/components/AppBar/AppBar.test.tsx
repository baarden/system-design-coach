import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppBar } from "./AppBar";

const mockNavigate = vi.fn();
const mockToggleTheme = vi.fn();
let mockMode: "light" | "dark" = "light";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../providers/auth", () => ({
  AuthUI: () => <div data-testid="auth-ui">Auth UI</div>,
}));

vi.mock("../../providers/theme", () => ({
  useTheme: () => ({
    mode: mockMode,
    toggleTheme: mockToggleTheme,
  }),
}));

function renderAppBar(props = {}) {
  return render(
    <MemoryRouter>
      <AppBar {...props} />
    </MemoryRouter>
  );
}

describe("AppBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMode = "light";
  });

  describe("rendering", () => {
    it("renders with default title", () => {
      renderAppBar();
      expect(screen.getByText("System Design Coach")).toBeInTheDocument();
    });

    it("renders with custom title", () => {
      renderAppBar({ title: "Custom Title" });
      expect(screen.getByText("Custom Title")).toBeInTheDocument();
    });

    it("renders hamburger menu icon", () => {
      renderAppBar();
      expect(screen.getByLabelText("menu")).toBeInTheDocument();
    });

    it("renders AuthUI component", () => {
      renderAppBar();
      expect(screen.getByTestId("auth-ui")).toBeInTheDocument();
    });
  });

  describe("menu interaction", () => {
    it("opens menu when hamburger icon is clicked", async () => {
      const user = userEvent.setup();
      renderAppBar();

      const menuButton = screen.getByLabelText("menu");
      await user.click(menuButton);

      expect(screen.getByText("Dark mode")).toBeInTheDocument();
      expect(screen.getByText("GitHub")).toBeInTheDocument();
    });

    it("opens GitHub URL in new tab when clicked", async () => {
      const user = userEvent.setup();
      const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      renderAppBar();

      await user.click(screen.getByLabelText("menu"));
      await user.click(screen.getByText("GitHub"));

      expect(windowOpenSpy).toHaveBeenCalledWith(
        "https://github.com/baarden/system-design-coach",
        "_blank"
      );

      windowOpenSpy.mockRestore();
    });

    it("closes menu after clicking GitHub", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "open").mockImplementation(() => null);

      renderAppBar();

      await user.click(screen.getByLabelText("menu"));
      expect(screen.getByText("GitHub")).toBeVisible();

      await user.click(screen.getByText("GitHub"));

      // Menu should close - GitHub text should no longer be visible
      expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
    });
  });

  describe("dark mode", () => {
    it("shows dark mode switch in menu", async () => {
      const user = userEvent.setup();
      renderAppBar();

      await user.click(screen.getByLabelText("menu"));

      expect(screen.getByText("Dark mode")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("switch is unchecked when mode is light", async () => {
      const user = userEvent.setup();
      mockMode = "light";
      renderAppBar();

      await user.click(screen.getByLabelText("menu"));

      expect(screen.getByRole("switch")).not.toBeChecked();
    });

    it("switch is checked when mode is dark", async () => {
      const user = userEvent.setup();
      mockMode = "dark";
      renderAppBar();

      await user.click(screen.getByLabelText("menu"));

      expect(screen.getByRole("switch")).toBeChecked();
    });

    it("calls toggleTheme when clicking the menu item", async () => {
      const user = userEvent.setup();
      renderAppBar();

      await user.click(screen.getByLabelText("menu"));
      await user.click(screen.getByText("Dark mode"));

      expect(mockToggleTheme).toHaveBeenCalled();
    });

    it("calls toggleTheme when clicking the switch", async () => {
      const user = userEvent.setup();
      renderAppBar();

      await user.click(screen.getByLabelText("menu"));
      await user.click(screen.getByRole("switch"));

      expect(mockToggleTheme).toHaveBeenCalled();
    });
  });

  describe("connection status", () => {
    it("shows Connected when isConnected is true", () => {
      renderAppBar({ isConnected: true });

      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("shows Disconnected when isConnected is false", () => {
      renderAppBar({ isConnected: false });

      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });

    it("does not show connection status when isConnected is undefined", () => {
      renderAppBar();

      expect(screen.queryByText("Connected")).not.toBeInTheDocument();
      expect(screen.queryByText("Disconnected")).not.toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("navigates to home when title is clicked", async () => {
      const user = userEvent.setup();
      renderAppBar();

      await user.click(screen.getByText("System Design Coach"));

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });
});
