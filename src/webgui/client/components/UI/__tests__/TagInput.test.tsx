import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import TagInput from "../TagInput";

describe("TagInput", () => {
  const defaultProps = {
    value: [],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default props", () => {
    render(<TagInput {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("Type and press Enter to add tags")
    ).toBeInTheDocument();
  });

  it("renders with custom label and placeholder", () => {
    render(
      <TagInput
        {...defaultProps}
        label="Custom Tags"
        placeholder="Custom placeholder"
      />
    );

    expect(screen.getByText("Custom Tags")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Custom placeholder")
    ).toBeInTheDocument();
  });

  it("displays existing tags", () => {
    render(
      <TagInput {...defaultProps} value={["react", "javascript", "frontend"]} />
    );

    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("javascript")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();
  });

  it("adds tag on Enter key", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(<TagInput {...defaultProps} onChange={mockOnChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "react");
    await user.keyboard("{Enter}");

    expect(mockOnChange).toHaveBeenCalledWith(["react"]);
  });

  it("adds tag on comma key", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(<TagInput {...defaultProps} onChange={mockOnChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "react,");

    expect(mockOnChange).toHaveBeenCalledWith(["react"]);
  });

  it("adds tag on Tab key", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(<TagInput {...defaultProps} onChange={mockOnChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "react");
    await user.keyboard("{Tab}");

    expect(mockOnChange).toHaveBeenCalledWith(["react"]);
  });

  it("removes tag when clicking remove button", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(
      <TagInput
        {...defaultProps}
        value={["react", "javascript"]}
        onChange={mockOnChange}
      />
    );

    const removeButton = screen.getByLabelText("Remove react tag");
    await user.click(removeButton);

    expect(mockOnChange).toHaveBeenCalledWith(["javascript"]);
  });

  it("removes last tag on backspace when input is empty", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(
      <TagInput
        {...defaultProps}
        value={["react", "javascript"]}
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.keyboard("{Backspace}");

    expect(mockOnChange).toHaveBeenCalledWith(["react"]);
  });

  it("prevents duplicate tags", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(
      <TagInput {...defaultProps} value={["react"]} onChange={mockOnChange} />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "react");
    await user.keyboard("{Enter}");

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("trims whitespace from tags", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(<TagInput {...defaultProps} onChange={mockOnChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "  react  ");
    await user.keyboard("{Enter}");

    expect(mockOnChange).toHaveBeenCalledWith(["react"]);
  });

  it("shows suggestions when typing", async () => {
    const user = userEvent.setup();

    render(
      <TagInput {...defaultProps} suggestions={["react", "redux", "router"]} />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "re");

    await waitFor(() => {
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getByText("redux")).toBeInTheDocument();
    });
  });

  it("filters suggestions based on input", async () => {
    const user = userEvent.setup();

    render(
      <TagInput {...defaultProps} suggestions={["react", "redux", "angular"]} />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "rea");

    await waitFor(() => {
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.queryByText("redux")).not.toBeInTheDocument();
      expect(screen.queryByText("angular")).not.toBeInTheDocument();
    });
  });

  it("navigates suggestions with arrow keys", async () => {
    const user = userEvent.setup();

    render(<TagInput {...defaultProps} suggestions={["react", "redux"]} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "re");

    await waitFor(() => {
      expect(screen.getByText("react")).toBeInTheDocument();
    });

    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("react")).toHaveClass("selected");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("redux")).toHaveClass("selected");
  });

  it("selects suggestion on click", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(
      <TagInput
        {...defaultProps}
        suggestions={["react", "redux"]}
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "re");

    await waitFor(() => {
      expect(screen.getByText("react")).toBeInTheDocument();
    });

    await user.click(screen.getByText("react"));

    expect(mockOnChange).toHaveBeenCalledWith(["react"]);
  });

  it("respects maxTags limit", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(
      <TagInput
        {...defaultProps}
        value={["tag1", "tag2"]}
        maxTags={2}
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();

    expect(screen.getByText("2/2 tags")).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<TagInput {...defaultProps} error="Too many tags" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Too many tags");
    expect(screen.getByRole("textbox").closest(".tag-input")).toHaveClass(
      "tag-input--error"
    );
  });

  it("closes suggestions on Escape key", async () => {
    const user = userEvent.setup();

    render(<TagInput {...defaultProps} suggestions={["react", "redux"]} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "re");

    await waitFor(() => {
      expect(screen.getByText("react")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("react")).not.toBeInTheDocument();
    });
  });

  it("has proper accessibility attributes", () => {
    render(
      <TagInput
        {...defaultProps}
        label="Tags Input"
        error="Error message"
        value={["react"]}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();

    const removeButton = screen.getByLabelText("Remove react tag");
    expect(removeButton).toBeInTheDocument();

    const errorElement = screen.getByRole("alert");
    expect(errorElement).toBeInTheDocument();
  });
});
