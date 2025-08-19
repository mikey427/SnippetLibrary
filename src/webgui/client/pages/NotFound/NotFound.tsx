import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/UI/Button";
import "./NotFound.css";

const NotFound: React.FC = () => {
  return (
    <div className="not-found-page" data-testid="not-found-page">
      <div className="not-found-content">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist.</p>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
