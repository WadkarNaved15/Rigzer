// src/context/FeedbackProvider.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import html2canvas from "html2canvas";
import FeedbackModal from "../components/Home/Feedback";

type FeedbackCtx = {
  open: () => void;                // normal (no screenshot)
  openWithScreenshot: () => void;  // for manual use if needed
};

const FeedbackContext = createContext<FeedbackCtx | null>(null);

export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
};

export default function FeedbackProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const open = () => {
    setScreenshot(null);
    setIsOpen(true);
  };

const captureAndOpen = async () => {
  try {
    setIsOpen(false); // hide modal during capture
    // Wait a bit to ensure layout is ready
    await new Promise((r) => setTimeout(r, 100)); 

    const body = document.body;
    console.log("body",body)
    if (!body) throw new Error("Body not found");

    const canvas = await html2canvas(body, {
      useCORS: true,
      backgroundColor: "#fff",
      scale: 1,
      logging: false,
      width: window.innerWidth,
      height: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("Canvas has 0 size");
    }

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) throw new Error("Failed to make blob");

    const file = new File([blob], "screenshot.png", { type: "image/png" });
    setScreenshot(file);
  } catch (err) {
    console.error("Screenshot failed", err);
    setScreenshot(null);
  } finally {
    setIsOpen(true);
  }
};


  // Global hotkey (works everywhere)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        captureAndOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <FeedbackContext.Provider value={{ open, openWithScreenshot: captureAndOpen }}>
      {children}
      <FeedbackModal
        isOpen={isOpen}
        screenshot={screenshot}
        onClose={() => setIsOpen(false)}
      />
    </FeedbackContext.Provider>
  );
}
