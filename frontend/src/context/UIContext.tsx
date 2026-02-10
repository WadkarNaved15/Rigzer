import React, { createContext, useContext, useState } from 'react';

interface UIContextType {
  isAdPlaying: boolean;
  setIsAdPlaying: (playing: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdPlaying, setIsAdPlaying] = useState(false);

  return (
    <UIContext.Provider value={{ isAdPlaying, setIsAdPlaying }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
};