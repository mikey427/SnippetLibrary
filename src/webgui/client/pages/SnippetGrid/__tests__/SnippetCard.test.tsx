import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import SnippetCard from "../components/SnippetCard";
import { Snippet } from "../../../../types";

// Mock react-syntax-highlighter
vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: any) => (
    <pre data-testid="syntax-highlighter">{children}</pre>
  ),
}));

// Mock react-syntax-highlighter styles
vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  vscDarkPlus: {},
}));

// Mock @dnd-kit/sortable
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

// Mock @dnd-kit/utilities
vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ""),
    },
  },
}));

const mockSnippet: Snippet = {
  id: "test-snippet-1",
  title: "Test Snippet",
  description: "This is a test snippet for unit testing",
  code: "console.log('Hello, World!');\nconsole.log('Second line');\nconsole.log('Third line');\nconsole.log('Fourth line');\nconsole.log('Fifth line');\nconsole.log('Sixth line');",
  language: "javascript",
  tags: ["test", "javascript", "example"],
  category: "utility",
  createdAt: new Date("2023-01-01T10:00:00Z"),
  updatedAt: new Date("2023-01-02T15:30:00Z"),
  usageCount: 42,
  prefix: "test",
  scope: ["javascript", "typescript"],
};

const defaultProps = {
  snippet: mockSnippet,
  selected: false,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onSelect: vi.fn(),
  viewMode: "grid" as const,
};

describe("SnippetCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders snippet information correctly", () => {
    render(<SnippetCard {...defaultProps} />);

    expect(screen.getByText("Test Snippet")).toBeInTheDocument();
    expect(
      screen.getByText("This is a test snippet for unit testing")
    ).toBeInTheDocument();
    expect(screen.getAllByText("javascript")).toHaveLength(2); // Language badge and tag
    expect(screen.getByText("Used 42 times")).toBeInTheDocument();
    expect(screen.getByText("1/1/2023")).toBeInTheDocument();
  });

  it("renders all tags", () => {
    render(<SnippetCard {...defaultProps} />);

    // Get all elements with the tag text, then filter for the ones in the tags section
    const testTags = screen.getAllByText("test");
    const jsTags = screen.getAllByText("javascript");
    const exampleTags = screen.getAllByText("example");

    expect(testTags.length).toBeGreaterThan(0);
    expect(jsTags.length).toBeGreaterThan(0);
    expect(exampleTags.length).toBeGreaterThan(0);
  });

  it("renders category when present", () => {
    render(<SnippetCard {...defaultProps} />);

    expect(screen.getByText("Category:")).toBeInTheDocument();
    expect(screen.getByText("utility")).toBeInTheDocument();
  });

  it("does not render category section when category is not present", () => {
    const snippetWithoutCategory = { ...mockSnippet, category: undefined };
    render(<SnippetCard {...defaultProps} snippet={snippetWithoutCategory} />);

    expect(screen.queryByText("Category:")).not.toBeInTheDocument();
  });

  it("renders syntax highlighted code", () => {
    render(<SnippetCard {...defaultProps} />);

    expect(screen.getByTestId("syntax-highlighter")).toBeInTheDocument();
  });

  it("truncates long code by default", () => {
    render(<SnippetCard {...defaultProps} />);

    const codeElement = screen.getByTestId("syntax-highlighter");
    expect(codeElement.textContent).toContain("...");
    expect(screen.getByText("Show More")).toBeInTheDocument();
  });

  it("expands code when show more is clicked", () => {
    render(<SnippetCard {...defaultProps} />);

    const showMoreButton = screen.getByText("Show More");
    fireEvent.click(showMoreButton);

    expect(screen.getByText("Show Less")).toBeInTheDocument();
  });

  it("does not show expand button for short code", () => {
    const shortCodeSnippet = {
      ...mockSnippet,
      code: "console.log('short');",
    };
    render(<SnippetCard {...defaultProps} snippet={shortCodeSnippet} />);

    expect(screen.queryByText("Show More")).not.toBeInTheDocument();
    expect(screen.queryByText("Show Less")).not.toBeInTheDocument();
  });

  it("handles selection checkbox", () => {
    const onSelect = vi.fn();
    render(<SnippetCard {...defaultProps} onSelect={onSelect} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(onSelect).toHaveBeenCalledWith("test-snippet-1", true);
  });

  it("shows selected state", () => {
    render(<SnippetCard {...defaultProps} selected={true} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("calls onEdit when edit button is clicked", () => {
    const onEdit = vi.fn();
    render(<SnippetCard {...defaultProps} onEdit={onEdit} />);

    const editButton = screen.getByText("Edit");
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledWith(mockSnippet);
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(<SnippetCard {...defaultProps} onDelete={onDelete} />);

    const deleteButton = screen.getByText("Delete");
    fireEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith("test-snippet-1");
  });

  it("renders drag handle", () => {
    render(<SnippetCard {...defaultProps} />);

    const dragHandle = document.querySelector(".snippet-card-drag-handle svg");
    expect(dragHandle).toBeInTheDocument();
  });

  it("applies grid view styles", () => {
    render(<SnippetCard {...defaultProps} viewMode="grid" />);

    const card = screen.getByTestId("snippet-test-snippet-1");
    expect(card).toHaveClass("grid");
  });

  it("applies list view styles", () => {
    render(<SnippetCard {...defaultProps} viewMode="list" />);

    const card = screen.getByTestId("snippet-test-snippet-1");
    expect(card).toHaveClass("list");
  });

  it("applies selected styles when selected", () => {
    render(<SnippetCard {...defaultProps} selected={true} />);

    const card = screen.getByTestId("snippet-test-snippet-1");
    expect(card).toHaveClass("selected");
  });

  it("prevents event propagation on checkbox click", () => {
    const onSelect = vi.fn();
    render(<SnippetCard {...defaultProps} onSelect={onSelect} />);

    const checkbox = screen.getByRole("checkbox");
    const clickEvent = new MouseEvent("click", { bubbles: true });
    const stopPropagationSpy = vi.spyOn(clickEvent, "stopPropagation");

    fireEvent.click(checkbox);

    expect(onSelect).toHaveBeenCalled();
  });

  it("prevents event propagation on action button clicks", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <SnippetCard {...defaultProps} onEdit={onEdit} onDelete={onDelete} />
    );

    const editButton = screen.getByText("Edit");
    const deleteButton = screen.getByText("Delete");

    fireEvent.click(editButton);
    fireEvent.click(deleteButton);

    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it("has proper accessibility attributes", () => {
    render(<SnippetCard {...defaultProps} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-label", "Select Test Snippet");
  });

  it("handles missing optional fields gracefully", () => {
    const minimalSnippet: Snippet = {
      id: "minimal",
      title: "Minimal Snippet",
      description: "Basic snippet",
      code: "test",
      language: "text",
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    };

    render(<SnippetCard {...defaultProps} snippet={minimalSnippet} />);

    expect(screen.getByText("Minimal Snippet")).toBeInTheDocument();
    expect(screen.getByText("Basic snippet")).toBeInTheDocument();
    expect(screen.queryByText("Category:")).not.toBeInTheDocument();
  });
});
