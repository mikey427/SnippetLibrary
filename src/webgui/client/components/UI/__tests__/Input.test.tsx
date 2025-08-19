import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Input from "../Input";

describe("Input", () => {
  it("renders with basic props", () => {
    render(<Input placeholder="Enter text" />);

    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Enter text");
  });

  it("renders with label", () => {
    render(<Input label="Username" />);

    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("displays error message", () => {
    render(<Input error="This field is required" />);

    const errorMessage = screen.getByRole("alert");
    expect(errorMessage).toHaveTextContent("This field is required");
    expect(screen.getByRole("textbox")).toHaveClass("input--error");
  });

  it("displays helper text when no error", () => {
    render(<Input helperText="Enter your username" />);

    expect(screen.getByText("Enter your username")).toBeInTheDocument();
  });

  it("prioritizes error over helper text", () => {
    render(<Input error="Error message" helperText="Helper text" />);

    expect(screen.getByText("Error message")).toBeInTheDocument();
    expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
  });

  it("handles value changes", () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test value" } });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    render(<Input className="custom-input" />);

    expect(screen.getByRole("textbox")).toHaveClass("custom-input");
  });

  it("generates unique id when not provided", () => {
    const { rerender } = render(<Input label="First" />);
    const firstInput = screen.getByLabelText("First");
    const firstId = firstInput.getAttribute("id");

    rerender(<Input label="Second" />);
    const secondInput = screen.getByLabelText("Second");
    const secondId = secondInput.getAttribute("id");

    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
  });

  it("uses provided id", () => {
    render(<Input id="custom-id" label="Test" />);

    const input = screen.getByLabelText("Test");
    expect(input).toHaveAttribute("id", "custom-id");
  });

  it("passes through other input props", () => {
    render(<Input type="email" required disabled />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toBeRequired();
    expect(input).toBeDisabled();
  });
});
