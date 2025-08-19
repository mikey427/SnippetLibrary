import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../store/store";
import { toggleSidebar } from "../../store/slices/uiSlice";
import Header from "./Header";
import Sidebar from "./Sidebar";
import NotificationContainer from "../Notifications/NotificationContainer";
import "./Layout.css";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const dispatch = useDispatch();
  const { sidebarOpen, theme } = useSelector((state: RootState) => state.ui);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  return (
    <div className={`layout ${theme}`} data-testid="layout">
      <Header onToggleSidebar={handleToggleSidebar} />
      <div className="layout-body">
        <Sidebar isOpen={sidebarOpen} />
        <main
          className={`main-content ${
            sidebarOpen ? "sidebar-open" : "sidebar-closed"
          }`}
        >
          {children}
        </main>
      </div>
      <NotificationContainer />
    </div>
  );
};

export default Layout;
