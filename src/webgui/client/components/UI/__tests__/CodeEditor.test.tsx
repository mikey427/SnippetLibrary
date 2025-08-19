import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import CodeEditor from "../CodeEditor";

describe("CodeEditor", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    language: "javascript",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default props", () => {
    render(<CodeEditor {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("Enter your code here...")
    ).toBeInTheDocument();
    expect(screen.getByText("javascript")).toBeInTheDocument();
    expect(screen.getByText("1 lines")).toBeInTheDocument();
  });

  it("renders with custom label and placeholder", () => {
    render(
      <CodeEditor
        {...defaultProps}
        label="Custom Code"
        placeholder="Custom placeholder"
      />
    );

    expect(screen.getByText("Custom Code")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Custom placeholder")
    ).toBeInTheDocument();
  });

  it("handles text input changes", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(<CodeEditor {...defaultProps} onChange={mockOnChange} />);

    const textarea = screen.getByRole("textbox");

    // Type a single character to test onChange
    await user.type(textarea, "a");

    // Check that onChange was called at least once
    expect(mockOnChange).toHaveBeenCalled();
  });

  it("toggles between edit and preview modes", async () => {
    const user = userEvent.setup();

    render(
      <CodeEditor {...defaultProps} value="console.log('Hello World');" />
    );

    const previewButton = screen.getByTitle("Toggle preview");
    expect(screen.getByText("Preview")).toBeInTheDocument();

    await user.click(previewButton);
    expect(screen.getByText("Edit")).toBeInTheDocument();

    // Should show syntax highlighted code in preview mode
    // The syntax highlighter breaks up the text, so we check for parts
    expect(screen.getByText("console")).toBeInTheDocument();
    expect(screen.getByText("log")).toBeInTheDocument();
  });

  it("toggles line numbers", async () => {
    const user = userEvent.setup();

    render(<CodeEditor {...defaultProps} />);

    const lineNumbersButton = screen.getByTitle("Toggle line numbers");
    expect(lineNumbersButton).toHaveClass("active"); // Default is true

    await user.click(lineNumbersButton);
    expect(lineNumbersButton).not.toHaveClass("active");
  });

  it("displays error message", () => {
    render(<CodeEditor {...defaultProps} error="Invalid code format" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid code format");
    expect(screen.getByRole("textbox").closest(".code-editor")).toHaveClass(
      "code-editor--error"
    );
  });

  it("shows correct line count", () => {
    const multilineCode = "line 1\nline 2\nline 3";

    render(<CodeEditor {...defaultProps} value={multilineCode} />);

    expect(screen.getByText("3 lines")).toBeInTheDocument();
  });

  it("handles different programming languages", () => {
    const { rerender } = render(
      <CodeEditor {...defaultProps} language="python" />
    );

    expect(screen.getByText("python")).toBeInTheDocument();

    rerender(<CodeEditor {...defaultProps} language="typescript" />);

    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("handles empty language gracefully", () => {
    render(<CodeEditor {...defaultProps} language="" />);

    expect(screen.getByText("Plain Text")).toBeInTheDocument();
  });

  it("applies custom rows", () => {
    render(<CodeEditor {...defaultProps} rows={15} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("rows", "15");
  });

  it("has proper accessibility attributes", () => {
    render(
      <CodeEditor {...defaultProps} label="Code Input" error="Error message" />
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("spellCheck", "false");

    const errorElement = screen.getByRole("alert");
    expect(errorElement).toBeInTheDocument();
  });
});
