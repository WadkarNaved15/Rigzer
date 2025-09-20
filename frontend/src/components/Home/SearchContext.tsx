import { createContext, useContext, useState } from "react";

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  submittedQuery: string;
  setSubmittedQuery: React.Dispatch<React.SetStateAction<string>>;
  showFilteredFeed: boolean;   // ✅ new state
  setShowFilteredFeed: React.Dispatch<React.SetStateAction<boolean>>;
}

const SearchContext = createContext<SearchContextType | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [showFilteredFeed, setShowFilteredFeed] = useState(false); // ✅ default: main feed

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        submittedQuery,
        setSubmittedQuery,
        showFilteredFeed,
        setShowFilteredFeed,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within SearchProvider");
  }
  return context;
};
