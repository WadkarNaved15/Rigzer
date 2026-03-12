import { createContext, useContext, useState } from "react";

type User = {
  _id: string;
  username?: string;
  avatar?: string;
};

type FollowCache = {
  users: User[];
  page: number;
  hasMore: boolean;
};

type FollowContextType = {
  followersCache: Record<string, FollowCache>;
  followingCache: Record<string, FollowCache>;
  setFollowersCache: React.Dispatch<React.SetStateAction<Record<string, FollowCache>>>;
  setFollowingCache: React.Dispatch<React.SetStateAction<Record<string, FollowCache>>>;
};

const FollowContext = createContext<FollowContextType | null>(null);

export const FollowProvider = ({ children }: { children: React.ReactNode }) => {

  const [followersCache, setFollowersCache] = useState<Record<string, FollowCache>>({});
  const [followingCache, setFollowingCache] = useState<Record<string, FollowCache>>({});

  return (
    <FollowContext.Provider
      value={{
        followersCache,
        followingCache,
        setFollowersCache,
        setFollowingCache
      }}
    >
      {children}
    </FollowContext.Provider>
  );
};

export const useFollow = () => {
  const context = useContext(FollowContext);
  if (!context) {
    throw new Error("useFollow must be used inside FollowProvider");
  }
  return context;
};