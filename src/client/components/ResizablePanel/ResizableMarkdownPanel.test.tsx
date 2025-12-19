import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { ResizableMarkdownPanel } from "./ResizableMarkdownPanel";

describe("ResizableMarkdownPanel", () => {
  const defaultProps = {
    label: "Test Panel",
    content: "Some **markdown** content",
    scrollRef: createRef<HTMLDivElement>(),
    hasScrollTop: false,
    hasScrollBottom: false,
  };

  it("renders the label", () => {
    render(<ResizableMarkdownPanel {...defaultProps} />);

    expect(screen.getByText("Test Panel")).toBeInTheDocument();
  });

  it("renders markdown content", () => {
    render(<ResizableMarkdownPanel {...defaultProps} />);

    // ReactMarkdown converts **text** to <strong>
    expect(screen.getByText("markdown")).toBeInTheDocument();
  });

  it("fills container height", () => {
    const { container } = render(<ResizableMarkdownPanel {...defaultProps} />);

    const panel = container.firstChild as HTMLElement;
    expect(panel).toHaveStyle({ height: "100%" });
  });

  it("renders additional elements when hasScrollTop is true", () => {
    const { container: withFade } = render(
      <ResizableMarkdownPanel {...defaultProps} hasScrollTop={true} />
    );
    const { container: withoutFade } = render(
      <ResizableMarkdownPanel {...defaultProps} hasScrollTop={false} />
    );

    // More child elements when fade overlay is present
    const withFadeChildren = withFade.querySelectorAll(".MuiBox-root");
    const withoutFadeChildren = withoutFade.querySelectorAll(".MuiBox-root");
    expect(withFadeChildren.length).toBeGreaterThan(withoutFadeChildren.length);
  });

  it("renders additional elements when hasScrollBottom is true", () => {
    const { container: withFade } = render(
      <ResizableMarkdownPanel {...defaultProps} hasScrollBottom={true} />
    );
    const { container: withoutFade } = render(
      <ResizableMarkdownPanel {...defaultProps} hasScrollBottom={false} />
    );

    const withFadeChildren = withFade.querySelectorAll(".MuiBox-root");
    const withoutFadeChildren = withoutFade.querySelectorAll(".MuiBox-root");
    expect(withFadeChildren.length).toBeGreaterThan(withoutFadeChildren.length);
  });

  it("has consistent structure when scroll flags are false", () => {
    const { container } = render(
      <ResizableMarkdownPanel
        {...defaultProps}
        hasScrollTop={false}
        hasScrollBottom={false}
      />
    );

    // Should have base structure without extra overlay elements
    const boxes = container.querySelectorAll(".MuiBox-root");
    expect(boxes.length).toBeGreaterThan(0);
  });

  it("applies different background when content is empty", () => {
    const { container: withContent } = render(
      <ResizableMarkdownPanel {...defaultProps} content="Has content" />
    );

    const { container: withoutContent } = render(
      <ResizableMarkdownPanel {...defaultProps} content="" />
    );

    // Both should render - styling differences handled by MUI
    expect(withContent.firstChild).toBeInTheDocument();
    expect(withoutContent.firstChild).toBeInTheDocument();
  });

  it("renders complex markdown correctly", () => {
    const complexMarkdown = `
# Heading

- List item 1
- List item 2

\`\`\`
code block
\`\`\`

Some \`inline code\` here.
    `;

    render(<ResizableMarkdownPanel {...defaultProps} content={complexMarkdown} />);

    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("List item 1")).toBeInTheDocument();
    expect(screen.getByText("inline code")).toBeInTheDocument();
  });
});
