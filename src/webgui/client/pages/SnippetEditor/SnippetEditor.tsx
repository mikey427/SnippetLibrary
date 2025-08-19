import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { createSnippet } from "../../store/slices/snippetsSlice";
import { addNotification } from "../../store/slices/uiSlice";
import Button from "../../components/UI/Button";
import Input from "../../components/UI/Input";
import "./SnippetEditor.css";

const SnippetEditor: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    code: "",
    language: "",
    tags: "",
    category: "",
  });

  const [loading, setLoading] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const snippetData = {
        ...formData,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      await dispatch(createSnippet(snippetData)).unwrap();

      dispatch(
        addNotification({
          type: "success",
          message: "Snippet created successfully!",
        })
      );

      navigate("/");
    } catch (error) {
      dispatch(
        addNotification({
          type: "error",
          message: "Failed to create snippet",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="snippet-editor" data-testid="snippet-editor">
      <div className="snippet-editor-header">
        <h2>Create New Snippet</h2>
        <Button variant="secondary" onClick={() => navigate("/")}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="snippet-form">
        <Input
          label="Title"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          required
          placeholder="Enter snippet title"
        />

        <Input
          label="Description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Brief description of the snippet"
        />

        <div className="input-group">
          <label htmlFor="language" className="input-label">
            Language
          </label>
          <select
            id="language"
            name="language"
            value={formData.language}
            onChange={handleInputChange}
            className="input"
            required
          >
            <option value="">Select language</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="css">CSS</option>
            <option value="html">HTML</option>
            <option value="json">JSON</option>
          </select>
        </div>

        <div className="input-group">
          <label htmlFor="code" className="input-label">
            Code
          </label>
          <textarea
            id="code"
            name="code"
            value={formData.code}
            onChange={handleInputChange}
            className="input code-textarea"
            rows={10}
            required
            placeholder="Enter your code snippet here..."
          />
        </div>

        <Input
          label="Tags"
          name="tags"
          value={formData.tags}
          onChange={handleInputChange}
          placeholder="Enter tags separated by commas"
          helperText="Separate multiple tags with commas"
        />

        <Input
          label="Category"
          name="category"
          value={formData.category}
          onChange={handleInputChange}
          placeholder="Optional category"
        />

        <div className="snippet-form-actions">
          <Button type="submit" loading={loading}>
            Create Snippet
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SnippetEditor;
