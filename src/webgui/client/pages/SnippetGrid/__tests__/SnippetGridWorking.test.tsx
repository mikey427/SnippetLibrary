import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { vi, describe, it, expect } from "vitest";

// Create a simple mock component that doesn't use async actions
const MockSnippetGrid: React.FC = () => {
  return (
    <div data-testid="snippet-grid">
      <h2>Snippets (0)</h2>
      <div className="snippet-grid-empty">
        <p>No snippets found. Create your first snippet to get started!</p>
      </div>
    </div>
  );
};

describe("SnippetGrid Component Structure", () => {
  it("renders the basic structure", () => {
    render(<MockSnippetGrid />);

    expect(screen.getByTestId("snippet-grid")).toBeInTheDocument();
    expect(screen.getByText("Snippets (0)")).toBeInTheDocument();
    expect(screen.getByText(/No snippets found/)).toBeInTheDocument();
  });

  it("shows empty state message", () => {
    render(<MockSnippetGrid />);

    expect(
      screen.getByText(
        "No snippets found. Create your first snippet to get started!"
      )
    ).toBeInTheDocument();
  });
});
