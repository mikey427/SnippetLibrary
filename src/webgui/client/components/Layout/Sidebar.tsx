import React from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

interface SidebarProps {
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const navItems = [
    { path: "/", label: "All Snippets", icon: "📄" },
    { path: "/snippets/new", label: "New Snippet", icon: "➕" },
    { path: "/search", label: "Search", icon: "🔍" },
    { path: "/import-export", label: "Import/Export", icon: "📁" },
  ];

  return (
    <aside
      className={`sidebar ${isOpen ? "open" : "closed"}`}
      data-testid="sidebar"
    >
      <nav className="sidebar-nav">
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
                data-testid={`nav-${item.path.replace("/", "") || "home"}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {isOpen && <span className="sidebar-label">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
