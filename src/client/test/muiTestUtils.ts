import { beforeAll, afterAll } from "vitest";

/**
 * Suppress console.error warnings from MUI component internals and other expected test noise.
 *
 * MUI components (Dialog, Button, etc.) have internal animations and transitions that trigger
 * React act() warnings in tests. These are unavoidable MUI implementation details, not test
 * quality issues. This utility suppresses those warnings while preserving real errors.
 *
 * @param additionalSuppressions - Optional array of error message patterns to suppress
 *
 * @example
 * ```typescript
 * describe("MyComponent", () => {
 *   suppressConsoleErrors();
 *
 *   it("renders correctly", () => {
 *     render(<MyComponent />);
 *     // No MUI warnings!
 *   });
 * });
 * ```
 *
 * @example With custom suppressions
 * ```typescript
 * describe("MyComponent", () => {
 *   suppressConsoleErrors([
 *     'Custom error message',
 *     /regex pattern/
 *   ]);
 * });
 * ```
 */
export function suppressConsoleErrors(
  additionalSuppressions: Array<string | RegExp> = []
) {
  const originalError = console.error;
  const originalWarn = console.warn;

  const shouldSuppress = (message: string): boolean => {
    // Suppress MUI act() warnings
    if (message.includes("Warning: An update to")) {
      if (
        message.includes("ForwardRef(") ||
        message.includes("Transition") ||
        message.includes("TouchRipple") ||
        message.includes("Fade") ||
        message.includes("Portal") ||
        message.includes("Modal")
      ) {
        return true;
      }
    }

    // Suppress additional custom patterns
    for (const pattern of additionalSuppressions) {
      if (typeof pattern === "string" && message.includes(pattern)) {
        return true;
      }
      if (pattern instanceof RegExp && pattern.test(message)) {
        return true;
      }
    }

    return false;
  };

  beforeAll(() => {
    console.error = (...args: any[]) => {
      const message =
        typeof args[0] === "string" ? args[0] : args[0]?.toString?.() || "";
      if (shouldSuppress(message)) return;
      originalError(...args);
    };

    console.warn = (...args: any[]) => {
      const message =
        typeof args[0] === "string" ? args[0] : args[0]?.toString?.() || "";
      if (shouldSuppress(message)) return;
      originalWarn(...args);
    };
  });

  afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });
}
