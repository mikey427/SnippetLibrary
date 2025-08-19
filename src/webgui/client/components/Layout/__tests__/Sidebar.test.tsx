import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import Sidebar from "../Sidebar";

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("Sidebar", () => {
  it("renders all navigation items", () => {
    renderWithRouter(<Sidebar isOpen={true} />);

    expect(screen.getByTestId("nav-home")).toBeInTheDocument();
    expect(screen.getByTestId("nav-snippets/new")).toBeInTheDocument();
    expect(screen.getByTestId("nav-search")).toBeInTheDocument();
    expect(screen.getByTestId("nav-import-export")).toBeInTheDocument();
  });

  it("applies open class when isOpen is true", () => {
    renderWithRouter(<Sidebar isOpen={true} />);

    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveClass("open");
  });

  it("applies closed class when isOpen is false", () => {
    renderWithRouter(<Sidebar isOpen={false} />);

    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveClass("closed");
  });

  it("displays navigation labels when open", () => {
    renderWithRouter(<Sidebar isOpen={true} />);

    expect(screen.getByText("All Snippets")).toBeInTheDocument();
    expect(screen.getByText("New Snippet")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Import/Export")).toBeInTheDocument();
  });

  it("displays navigation icons", () => {
    renderWithRouter(<Sidebar isOpen={true} />);

    expect(screen.getByText("📄")).toBeInTheDocument();
    expect(screen.getByText("➕")).toBeInTheDocument();
    expect(screen.getByText("🔍")).toBeInTheDocument();
    expect(screen.getByText("📁")).toBeInTheDocument();
  });

  it("has correct navigation links", () => {
    renderWithRouter(<Sidebar isOpen={true} />);

    const homeLink = screen.getByTestId("nav-home");
    const newSnippetLink = screen.getByTestId("nav-snippets/new");
    const searchLink = screen.getByTestId("nav-search");
    const importExportLink = screen.getByTestId("nav-import-export");

    expect(homeLink).toHaveAttribute("href", "/");
    expect(newSnippetLink).toHaveAttribute("href", "/snippets/new");
    expect(searchLink).toHaveAttribute("href", "/search");
    expect(importExportLink).toHaveAttribute("href", "/import-export");
  });
});
