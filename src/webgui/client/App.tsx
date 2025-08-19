import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import SnippetGrid from "./pages/SnippetGrid/SnippetGrid";
import SnippetEditor from "./pages/SnippetEditor/SnippetEditor";
import SearchPage from "./pages/Search/SearchPage";
import ImportExport from "./pages/ImportExport/ImportExport";
import NotFound from "./pages/NotFound/NotFound";

const App: React.FC = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SnippetGrid />} />
        <Route path="/snippets" element={<SnippetGrid />} />
        <Route path="/snippets/new" element={<SnippetEditor />} />
        <Route path="/snippets/:id/edit" element={<SnippetEditor />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/import-export" element={<ImportExport />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};

export default App;
