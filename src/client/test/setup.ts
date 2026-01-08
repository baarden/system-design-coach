import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, afterAll } from "vitest";
import { server } from "./mocks/server";
import { suppressConsoleErrors } from "./muiTestUtils";

// Mock ResizeObserver (not available in jsdom)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Suppress MUI act() warnings globally for all tests
suppressConsoleErrors();

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Setup MSW
beforeAll(() => {
  // Changed to "warn" since we now use TypeScript shared types for contract enforcement
  // and some tests use vi.mock() instead of MSW handlers
  server.listen({ onUnhandledRequest: "warn" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
