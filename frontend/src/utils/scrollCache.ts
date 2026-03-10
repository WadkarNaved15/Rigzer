// src/utils/scrollCache.ts
const scrollCache = new Map<string, number>();

export const saveScroll = (key: string, position: number) => {
  scrollCache.set(key, position);
};

export const getScroll = (key: string): number => {
  return scrollCache.get(key) ?? 0;
};

export const clearScroll = (key: string) => {
  scrollCache.delete(key);
};