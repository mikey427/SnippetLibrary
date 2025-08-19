import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { createSnippet, updateSnippet } from "../../store/slices/snippetsSlice";
import { addNotification } from "../../store/slices/uiSlice";
import { RootState } from "../../store";
import Button from "../../components/UI/Button";
import Input from "../../components/UI/Input";
import Select from "../../components/UI/Select";
import TagInput from "../../components/UI/TagInput";
import CodeEditor from "../../components/UI/CodeEditor";
import {
  validateForm,
  snippetValidationRules,
  ValidationErrors,
} from "../../utils/validation";
import { Snippet } from "../../types/Snippet";
import "./SnippetEditor.css";

const SnippetEditor: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const snippets = useSelector((state: RootState) => state.snippets.items);
  const existingSnippet = isEditing ? snippets.find((s) => s.id === id) : null;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    code: "",
    language: "",
    tags: [] as string[],
    category: "",
    prefix: "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showPreview, setShowPreview] = useState(false);

  // Language options
  const languageOptions = [
    { value: "", label: "Select language" },
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "css", label: "CSS" },
    { value: "html", label: "HTML" },
    { value: "json", label: "JSON" },
    { value: "jsx", label: "JSX" },
    { value: "tsx", label: "TSX" },
    { value: "sql", label: "SQL" },
    { value: "bash", label: "Bash" },
    { value: "yaml", label: "YAML" },
    { value: "xml", label: "XML" },
    { value: "markdown", label: "Markdown" },
  ];

  // Common tag suggestions (could be fetched from existing snippets)
  const tagSuggestions = [
    "react",
    "vue",
    "angular",
    "node",
    "express",
    "api",
    "database",
    "authentication",
    "validation",
    "utility",
    "helper",
    "component",
    "hook",
    "service",
    "middleware",
    "test",
    "mock",
    "config",
    "setup",
  ];

  // Load existing snippet data when editing
  useEffect(() => {
    if (isEditing && existingSnippet) {
      setFormData({
        title: existingSnippet.title,
        description: existingSnippet.description,
        code: existingSnippet.code,
        language: existingSnippet.language,
        tags: existingSnippet.tags,
        category: existingSnippet.category || "",
        prefix: existingSnippet.prefix || "",
      });
    }
  }, [isEditing, existingSnippet]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleCodeChange = (code: string) => {
    setFormData((prev) => ({ ...prev, code }));

    // Clear error for code field when user starts typing
    if (errors.code) {
      setErrors((prev) => ({ ...prev, code: "" }));
    }
  };

  const handleTagsChange = (tags: string[]) => {
    setFormData((prev) => ({ ...prev, tags }));

    // Clear error for tags field when user makes changes
    if (errors.tags) {
      setErrors((prev) => ({ ...prev, tags: "" }));
    }
  };

  const validateFormData = (): boolean => {
    const validationErrors = validateForm(formData, snippetValidationRules);
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateFormData()) {
      return;
    }

    setLoading(true);

    try {
      const snippetData = {
        ...formData,
        // Remove empty prefix if not provided
        prefix: formData.prefix.trim() || undefined,
        // Remove empty category if not provided
        category: formData.category.trim() || undefined,
      };

      if (isEditing && existingSnippet) {
        await dispatch(
          updateSnippet({
            id: existingSnippet.id,
            updates: snippetData,
          })
        ).unwrap();

        dispatch(
          addNotification({
            type: "success",
            message: "Snippet updated successfully!",
          })
        );
      } else {
        await dispatch(createSnippet(snippetData)).unwrap();

        dispatch(
          addNotification({
            type: "success",
            message: "Snippet created successfully!",
          })
        );
      }

      navigate("/");
    } catch (error) {
      dispatch(
        addNotification({
          type: "error",
          message: `Failed to ${isEditing ? "update" : "create"} snippet`,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/");
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <div className="snippet-editor" data-testid="snippet-editor">
      <div className="snippet-editor-header">
        <h2>{isEditing ? "Edit Snippet" : "Create New Snippet"}</h2>
        <div className="snippet-editor-header-actions">
          <Button
            variant="ghost"
            onClick={togglePreview}
            disabled={!formData.code}
          >
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>

      <div className="snippet-editor-content">
        <form onSubmit={handleSubmit} className="snippet-form" role="form">
          <div className="snippet-form-row">
            <Input
              label="Title *"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              error={errors.title}
              placeholder="Enter snippet title"
            />

            <Select
              label="Language *"
              name="language"
              value={formData.language}
              onChange={handleInputChange}
              options={languageOptions}
              error={errors.language}
            />
          </div>

          <Input
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            error={errors.description}
            placeholder="Brief description of the snippet"
          />

          <CodeEditor
            label="Code *"
            value={formData.code}
            onChange={handleCodeChange}
            language={formData.language}
            error={errors.code}
            placeholder="Enter your code snippet here..."
          />

          <div className="snippet-form-row">
            <TagInput
              label="Tags"
              value={formData.tags}
              onChange={handleTagsChange}
              suggestions={tagSuggestions}
              error={errors.tags}
              maxTags={20}
            />

            <Input
              label="Category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              error={errors.category}
              placeholder="Optional category"
            />
          </div>

          <Input
            label="Prefix"
            name="prefix"
            value={formData.prefix}
            onChange={handleInputChange}
            error={errors.prefix}
            placeholder="Optional VS Code snippet prefix"
            helperText="Used for triggering the snippet in VS Code (e.g., 'rfc' for React Function Component)"
          />

          <div className="snippet-form-actions">
            <Button variant="secondary" onClick={handleCancel} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {isEditing ? "Update Snippet" : "Create Snippet"}
            </Button>
          </div>
        </form>

        {showPreview && formData.code && (
          <div className="snippet-preview">
            <h3>Preview</h3>
            <div className="snippet-preview-content">
              <div className="snippet-preview-header">
                <h4>{formData.title || "Untitled Snippet"}</h4>
                <span className="snippet-preview-language">
                  {formData.language}
                </span>
              </div>
              {formData.description && (
                <p className="snippet-preview-description">
                  {formData.description}
                </p>
              )}
              <CodeEditor
                value={formData.code}
                onChange={() => {}} // Read-only in preview
                language={formData.language}
              />
              {formData.tags.length > 0 && (
                <div className="snippet-preview-tags">
                  {formData.tags.map((tag, index) => (
                    <span key={index} className="snippet-preview-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SnippetEditor;
