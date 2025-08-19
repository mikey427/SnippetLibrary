import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Snippet } from "../../../../types";
import Button from "../../../components/UI/Button";
import "./SnippetCard.css";

interface SnippetCardProps {
  snippet: Snippet;
  selected: boolean;
  onEdit: (snippet: Snippet) => void;
  onDelete: (snippetId: string) => void;
  onSelect: (snippetId: string, selected: boolean) => void;
  viewMode: "grid" | "list";
}

const SnippetCard: React.FC<SnippetCardProps> = ({
  snippet,
  selected,
  onEdit,
  onDelete,
  onSelect,
  viewMode,
}) => {
  const [showFullCode, setShowFullCode] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: snippet.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect(snippet.id, e.target.checked);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(snippet);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(snippet.id);
  };

  const truncateCode = (code: string, maxLines: number = 5) => {
    const lines = code.split("\n");
    if (lines.length <= maxLines) return code;
    return lines.slice(0, maxLines).join("\n") + "\n...";
  };

  const displayCode = showFullCode ? snippet.code : truncateCode(snippet.code);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`snippet-card ${viewMode} ${selected ? "selected" : ""} ${
        isDragging ? "dragging" : ""
      }`}
      data-testid={`snippet-${snippet.id}`}
      {...attributes}
    >
      <div className="snippet-card-drag-handle" {...listeners}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="2" cy="2" r="1" />
          <circle cx="6" cy="2" r="1" />
          <circle cx="10" cy="2" r="1" />
          <circle cx="2" cy="6" r="1" />
          <circle cx="6" cy="6" r="1" />
          <circle cx="10" cy="6" r="1" />
          <circle cx="2" cy="10" r="1" />
          <circle cx="6" cy="10" r="1" />
          <circle cx="10" cy="10" r="1" />
        </svg>
      </div>

      <div className="snippet-card-checkbox">
        <input
          type="checkbox"
          checked={selected}
          onChange={handleCheckboxChange}
          aria-label={`Select ${snippet.title}`}
        />
      </div>

      <div className="snippet-card-content">
        <div className="snippet-card-header">
          <div className="snippet-card-title-section">
            <h3 className="snippet-card-title">{snippet.title}</h3>
            <span className="snippet-language">{snippet.language}</span>
          </div>
          <div className="snippet-card-meta">
            <span className="snippet-usage">
              Used {snippet.usageCount} times
            </span>
            <span className="snippet-date">
              {new Date(snippet.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <p className="snippet-description">{snippet.description}</p>

        <div className="snippet-code-preview">
          <div className="snippet-code-header">
            <span>Code Preview</span>
            {snippet.code.split("\n").length > 5 && (
              <button
                className="snippet-code-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullCode(!showFullCode);
                }}
              >
                {showFullCode ? "Show Less" : "Show More"}
              </button>
            )}
          </div>
          <div className="snippet-code-container">
            <SyntaxHighlighter
              language={snippet.language.toLowerCase()}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: "8px",
                fontSize: "12px",
                borderRadius: "4px",
              }}
              showLineNumbers={false}
              wrapLines={true}
            >
              {displayCode}
            </SyntaxHighlighter>
          </div>
        </div>

        <div className="snippet-tags">
          {snippet.tags.map((tag) => (
            <span key={tag} className="snippet-tag">
              {tag}
            </span>
          ))}
        </div>

        {snippet.category && (
          <div className="snippet-category">
            <span className="snippet-category-label">Category:</span>
            <span className="snippet-category-value">{snippet.category}</span>
          </div>
        )}
      </div>

      <div className="snippet-card-actions">
        <Button size="sm" variant="secondary" onClick={handleEdit}>
          Edit
        </Button>
        <Button size="sm" variant="danger" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
};

export default SnippetCard;
