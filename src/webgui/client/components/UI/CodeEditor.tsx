import React, { useState, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./CodeEditor.css";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  placeholder?: string;
  error?: string;
  label?: string;
  rows?: number;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  placeholder = "Enter your code here...",
  error,
  label,
  rows = 10,
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const [lineNumbers, setLineNumbers] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const togglePreview = () => {
    setIsPreview(!isPreview);
  };

  const toggleLineNumbers = () => {
    setLineNumbers(!lineNumbers);
  };

  // Get language for syntax highlighter (map common languages)
  const getSyntaxLanguage = (lang: string): string => {
    const languageMap: { [key: string]: string } = {
      javascript: "javascript",
      typescript: "typescript",
      python: "python",
      java: "java",
      css: "css",
      html: "markup",
      json: "json",
      jsx: "jsx",
      tsx: "tsx",
      sql: "sql",
      bash: "bash",
      shell: "bash",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
      markdown: "markdown",
      md: "markdown",
    };
    return languageMap[lang.toLowerCase()] || "text";
  };

  return (
    <div className="code-editor-container">
      {label && <label className="code-editor-label">{label}</label>}

      <div className="code-editor-toolbar">
        <div className="code-editor-controls">
          <button
            type="button"
            className={`code-editor-toggle ${isPreview ? "active" : ""}`}
            onClick={togglePreview}
            title="Toggle preview"
          >
            {isPreview ? "Edit" : "Preview"}
          </button>
          <button
            type="button"
            className={`code-editor-toggle ${lineNumbers ? "active" : ""}`}
            onClick={toggleLineNumbers}
            title="Toggle line numbers"
          >
            Line Numbers
          </button>
        </div>
        <div className="code-editor-info">
          <span className="code-editor-language">
            {language || "Plain Text"}
          </span>
          <span className="code-editor-lines">
            {value.split("\n").length} lines
          </span>
        </div>
      </div>

      <div className={`code-editor ${error ? "code-editor--error" : ""}`}>
        {isPreview ? (
          <div className="code-editor-preview">
            <SyntaxHighlighter
              language={getSyntaxLanguage(language)}
              style={vscDarkPlus}
              showLineNumbers={lineNumbers}
              customStyle={{
                margin: 0,
                borderRadius: "var(--border-radius)",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              {value || placeholder}
            </SyntaxHighlighter>
          </div>
        ) : (
          <textarea
            className="code-editor-textarea"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            rows={rows}
            spellCheck={false}
            style={{
              fontFamily: "Consolas, 'Courier New', monospace",
              fontSize: "14px",
              lineHeight: "1.5",
              tabSize: 2,
            }}
          />
        )}
      </div>

      {error && (
        <span className="code-editor-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export default CodeEditor;
