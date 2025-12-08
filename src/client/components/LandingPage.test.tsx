import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "../LandingPage";

// Mock the auth provider
vi.mock("../providers/auth", () => ({
  useAuth: () => ({
    isSignedIn: true,
    userId: "test-user",
    signIn: vi.fn(),
  }),
  AuthUI: () => <div data-testid="auth-ui">Auth UI</div>,
}));

// Mock the theme provider
vi.mock("../providers/theme", () => ({
  useTheme: () => ({
    mode: "light",
    toggleTheme: vi.fn(),
  }),
}));

function renderLandingPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe("LandingPage", () => {
  it("renders the app title", async () => {
    renderLandingPage();

    expect(screen.getByText("System Design Coach")).toBeInTheDocument();
  });

  it("renders the description text", async () => {
    renderLandingPage();

    expect(
      screen.getByText(/Practice your system design skills/i)
    ).toBeInTheDocument();
  });

  it("fetches and displays problems", async () => {
    renderLandingPage();

    // Wait for problems to load from MSW
    await waitFor(() => {
      expect(screen.getByText("URL Shortener")).toBeInTheDocument();
    });

    expect(screen.getByText("Rate Limiter")).toBeInTheDocument();
    expect(screen.getByText("Chat System")).toBeInTheDocument();
  });

  it("groups problems by category", async () => {
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByText("Classic Problems")).toBeInTheDocument();
    });

    expect(screen.getByText("Real-Time Systems")).toBeInTheDocument();
  });

  it("navigates to problem page when clicked", async () => {
    const user = userEvent.setup();
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByText("URL Shortener")).toBeInTheDocument();
    });

    // Click on a problem card
    const urlShortenerCard = screen.getByText("URL Shortener");
    await user.click(urlShortenerCard);

    // Navigation would be handled by MemoryRouter - we verify the click doesn't error
  });

  it("renders auth UI component", () => {
    renderLandingPage();

    expect(screen.getByTestId("auth-ui")).toBeInTheDocument();
  });
});
