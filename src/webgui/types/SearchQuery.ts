export interface SearchQuery {
  text?: string;
  language?: string;
  tags?: string[];
  category?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: "title" | "createdAt" | "usageCount";
  sortOrder?: "asc" | "desc";
}
