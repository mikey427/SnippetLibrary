import React, { useEffect } from "react";
import Button from "../UI/Button";
import "./Notification.css";

interface NotificationData {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  timestamp: number;
}

interface NotificationProps {
  notification: NotificationData;
  onDismiss: (id: string) => void;
}

const Notification: React.FC<NotificationProps> = ({
  notification,
  onDismiss,
}) => {
  const { id, type, message } = notification;

  useEffect(() => {
    if (type === "success" || type === "info") {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [id, type, onDismiss]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "ℹ️";
    }
  };

  return (
    <div
      className={`notification notification--${type}`}
      data-testid={`notification-${type}`}
    >
      <div className="notification-content">
        <span className="notification-icon">{getIcon()}</span>
        <span className="notification-message">{message}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="notification-dismiss"
      >
        ×
      </Button>
    </div>
  );
};

export default Notification;
