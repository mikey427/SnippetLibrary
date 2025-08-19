import { Snippet } from "../../types/Snippet";
import { SearchQuery } from "../../types/SearchQuery";

const API_BASE_URL = "/api";

class SnippetAPI {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  async getAll(): Promise<Snippet[]> {
    return this.request<Snippet[]>("/snippets");
  }

  async getById(id: string): Promise<Snippet> {
    return this.request<Snippet>(`/snippets/${id}`);
  }

  async create(
    snippet: Omit<Snippet, "id" | "createdAt" | "updatedAt" | "usageCount">
  ): Promise<Snippet> {
    return this.request<Snippet>("/snippets", {
      method: "POST",
      body: JSON.stringify(snippet),
    });
  }

  async update(id: string, updates: Partial<Snippet>): Promise<Snippet> {
    return this.request<Snippet>(`/snippets/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async delete(id: string): Promise<void> {
    await this.request<void>(`/snippets/${id}`, {
      method: "DELETE",
    });
  }

  async search(query: SearchQuery): Promise<Snippet[]> {
    return this.request<Snippet[]>("/snippets/search", {
      method: "POST",
      body: JSON.stringify(query),
    });
  }

  async import(
    file: File
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/snippets/import`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  async export(format: "json" | "yaml" = "json"): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/snippets/export?format=${format}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.blob();
  }
}

export const snippetAPI = new SnippetAPI();
