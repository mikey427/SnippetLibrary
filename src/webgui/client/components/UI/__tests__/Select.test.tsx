import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Select from "../Select";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { describe } from "node:test";

describe("Select", () => {
  const defaultOptions = [
    { value: "", label: "Select option" },
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
  ];

  const defaultProps = {
    options: defaultOptions,
  };

  it("renders with default props", () => {
    render(<Select {...defaultProps} />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    expect(screen.getByText("Select option")).toBeInTheDocument();
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(<Select {...defaultProps} label="Custom Label" />);

    expect(screen.getByText("Custom Label")).toBeInTheDocument();
    expect(screen.getByLabelText("Custom Label")).toBeInTheDocument();
  });

  it("handles value changes", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(<Select {...defaultProps} onChange={mockOnChange} />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "option1");

    expect(mockOnChange).toHaveBeenCalled();
    expect(select).toHaveValue("option1");
  });

  it("shows selected value", () => {
    render(<Select {...defaultProps} value="option2" />);

    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("option2");
  });

  it("displays error message", () => {
    render(<Select {...defaultProps} error="This field is required" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This field is required"
    );
    expect(screen.getByRole("combobox")).toHaveClass("select--error");
  });

  it("displays helper text", () => {
    render(
      <Select {...defaultProps} helperText="Choose an option from the list" />
    );

    expect(
      screen.getByText("Choose an option from the list")
    ).toBeInTheDocument();
  });

  it("prioritizes error over helper text", () => {
    render(
      <Select
        {...defaultProps}
        error="Error message"
        helperText="Helper text"
      />
    );

    expect(screen.getByText("Error message")).toBeInTheDocument();
    expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
  });

  it("handles disabled state", () => {
    render(<Select {...defaultProps} disabled />);

    const select = screen.getByRole("combobox");
    expect(select).toBeDisabled();
  });

  it("applies custom className", () => {
    render(<Select {...defaultProps} className="custom-class" />);

    const select = screen.getByRole("combobox");
    expect(select).toHaveClass("custom-class");
  });

  it("forwards other props to select element", () => {
    render(<Select {...defaultProps} data-testid="custom-select" required />);

    const select = screen.getByTestId("custom-select");
    expect(select).toBeRequired();
  });

  it("generates unique id when not provided", () => {
    const { container } = render(
      <Select {...defaultProps} label="Test Label" />
    );

    const select = container.querySelector("select");
    const label = container.querySelector("label");

    expect(select).toHaveAttribute("id");
    expect(label).toHaveAttribute("for", select?.getAttribute("id"));
  });

  it("uses provided id", () => {
    render(<Select {...defaultProps} id="custom-id" label="Custom Label" />);

    const select = screen.getByRole("combobox");
    const label = screen.getByText("Custom Label");

    expect(select).toHaveAttribute("id", "custom-id");
    expect(label).toHaveAttribute("for", "custom-id");
  });

  it("has proper accessibility attributes", () => {
    render(
      <Select
        {...defaultProps}
        label="Accessible Select"
        error="Error message"
        required
      />
    );

    const select = screen.getByRole("combobox");
    expect(select).toBeRequired();
    expect(select).toHaveAccessibleName("Accessible Select");

    const errorElement = screen.getByRole("alert");
    expect(errorElement).toBeInTheDocument();
  });
});
