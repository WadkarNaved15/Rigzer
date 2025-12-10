import { createContext, useContext, useState } from "react";
import type { PostProps } from "../types/Post";

type FeedContextType = {
  posts: PostProps[];
  setPosts: React.Dispatch<React.SetStateAction<PostProps[]>>;
  nextCursor: string | null;
  setNextCursor: React.Dispatch<React.SetStateAction<string | null>>;
  hasMore: boolean;
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  scrollY: number;
  setScrollY: React.Dispatch<React.SetStateAction<number>>;
};

const FeedContext = createContext<FeedContextType | null>(null);

export const FeedProvider = ({ children }: { children: React.ReactNode }) => {
  const [posts, setPosts] = useState<PostProps[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [scrollY, setScrollY] = useState(0);

  return (
    <FeedContext.Provider
      value={{
        posts,
        setPosts,
        nextCursor,
        setNextCursor,
        hasMore,
        setHasMore,
        scrollY,
        setScrollY,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
};

export const useFeed = () => {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("useFeed must be used inside FeedProvider");
  return ctx;
};
