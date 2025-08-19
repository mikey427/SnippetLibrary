import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Button from "../Button";
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

describe("Button", () => {
  it("renders with default props", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Click me");
    expect(button).toHaveClass("button", "button--primary", "button--md");
  });

  it("applies variant classes correctly", () => {
    const { rerender } = render(<Button variant="secondary">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("button--secondary");

    rerender(<Button variant="ghost">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("button--ghost");

    rerender(<Button variant="danger">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("button--danger");
  });

  it("applies size classes correctly", () => {
    const { rerender } = render(<Button size="sm">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("button--sm");

    rerender(<Button size="lg">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("button--lg");
  });

  it("shows loading state correctly", () => {
    render(<Button loading>Loading</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("button--loading");
    expect(button).toBeDisabled();
    expect(screen.getByText("Loading")).toHaveClass("button-content--hidden");
  });

  it("handles disabled state", () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Click me
      </Button>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not call onClick when loading", () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} loading>
        Click me
      </Button>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Test</Button>);

    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  it("passes through other props", () => {
    render(
      <Button data-testid="custom-button" type="submit">
        Test
      </Button>
    );

    const button = screen.getByTestId("custom-button");
    expect(button).toHaveAttribute("type", "submit");
  });
});
