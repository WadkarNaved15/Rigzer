import { useEffect, useRef } from "react";

export function useScrollRestoration(
  key: string,
  savedPosition: number,
  isReady: boolean
) {
  const hasRestored = useRef(false);
  const rafRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    hasRestored.current = false;
    attemptsRef.current = 0;
  }, [key]);

  useEffect(() => {
    if (hasRestored.current || !isReady || savedPosition <= 0) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // Retry scroll until the page is tall enough to actually scroll there.
    // This handles cases where content renders progressively (images loading, etc.)
    const MAX_ATTEMPTS = 10;

    const attempt = () => {
      attemptsRef.current += 1;

      const pageHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const canScroll = pageHeight - viewportHeight >= savedPosition;

      if (canScroll) {
        hasRestored.current = true;
        window.scrollTo({ top: savedPosition, behavior: "instant" as ScrollBehavior });
      } else if (attemptsRef.current < MAX_ATTEMPTS) {
        // Page isn't tall enough yet — wait a frame and retry
        rafRef.current = requestAnimationFrame(attempt);
      }
    };

    rafRef.current = requestAnimationFrame(attempt);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isReady, savedPosition, key]);
}