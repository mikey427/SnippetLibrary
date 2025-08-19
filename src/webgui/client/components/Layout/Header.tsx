import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { RootState } from "../../store/store";
import { setTheme, setViewMode } from "../../store/slices/uiSlice";
import Button from "../UI/Button";
import "./Header.css";

interface HeaderProps {
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const dispatch = useDispatch();
  const { theme, viewMode } = useSelector((state: RootState) => state.ui);

  const handleThemeToggle = () => {
    dispatch(setTheme(theme === "light" ? "dark" : "light"));
  };

  const handleViewModeToggle = () => {
    dispatch(setViewMode(viewMode === "grid" ? "list" : "grid"));
  };

  return (
    <header className="header" data-testid="header">
      <div className="header-left">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          data-testid="sidebar-toggle"
        >
          ☰
        </Button>
        <Link to="/" className="header-logo">
          <h1>Snippet Library</h1>
        </Link>
      </div>

      <div className="header-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewModeToggle}
          aria-label={`Switch to ${viewMode === "grid" ? "list" : "grid"} view`}
          data-testid="view-mode-toggle"
        >
          {viewMode === "grid" ? "☰" : "⊞"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleThemeToggle}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          data-testid="theme-toggle"
        >
          {theme === "light" ? "🌙" : "☀️"}
        </Button>
      </div>
    </header>
  );
};

export default Header;
