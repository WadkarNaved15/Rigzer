import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

export interface ArticlePreview {
  _id: string;
  title: string;
  hero_image_url?: string;
  author_name?: string;
  publishedAt?: string;
}

interface ContextType {
  articles: ArticlePreview[];
  loading: boolean;
}

const PublishedArticlesContext = createContext<ContextType | null>(null);

export const PublishedArticlesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [articles, setArticles] = useState<ArticlePreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/api/articles/published`)
      .then(res => setArticles(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PublishedArticlesContext.Provider value={{ articles, loading }}>
      {children}
    </PublishedArticlesContext.Provider>
  );
};

export const usePublishedArticles = () => {
  const ctx = useContext(PublishedArticlesContext);
  if (!ctx) {
    throw new Error("usePublishedArticles must be used inside PublishedArticlesProvider");
  }
  return ctx;
};
