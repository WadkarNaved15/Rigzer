import { useEffect, useRef } from "react";

export function useScrollRestoration(
  key: string,
  savedPosition: number,
  isReady: boolean
) {
  const hasRestored = useRef(false);
  const rafRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    hasRestored.current = false;
    attemptsRef.current = 0;
  }, [key]);

  useEffect(() => {
    if (hasRestored.current || !isReady || savedPosition <= 0) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const MAX_ATTEMPTS = 30;      // ~500ms at 60fps
    const MAX_WAIT_MS = 2000;     // hard stop after 2 seconds

    startTimeRef.current = performance.now();

    const attempt = () => {
      attemptsRef.current += 1;

      const elapsed = performance.now() - startTimeRef.current;
      const pageHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const canScroll = pageHeight - viewportHeight >= savedPosition;

      if (canScroll) {
        hasRestored.current = true;
        window.scrollTo({ top: savedPosition, behavior: "instant" as ScrollBehavior });
      } else if (attemptsRef.current < MAX_ATTEMPTS && elapsed < MAX_WAIT_MS) {
        rafRef.current = requestAnimationFrame(attempt);
      }
      // If we exhausted attempts, silently give up — better than scrolling to wrong place
    };

    rafRef.current = requestAnimationFrame(attempt);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isReady, savedPosition, key]);
}