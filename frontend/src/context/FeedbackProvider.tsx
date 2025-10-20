// src/context/FeedbackProvider.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import html2canvas from "html2canvas";
import { domToPng } from "modern-screenshot"; 
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

  // Wait for lazy-loaded content to finish loading
  const waitForLazyContent = async () => {
    // Wait for lazy-loaded images
    const lazyImages = document.querySelectorAll('img[loading="lazy"], img[data-src], img[src=""], .lazy-loaded');
    
    const imagePromises = Array.from(lazyImages).map((img) => {
      return new Promise((resolve) => {
        const image = img as HTMLImageElement;
        
        if (image.complete && image.naturalWidth > 0) {
          resolve(null);
          return;
        }
        
        const onLoad = () => {
          resolve(null);
          image.removeEventListener('load', onLoad);
          image.removeEventListener('error', onLoad);
        };
        
        image.addEventListener('load', onLoad);
        image.addEventListener('error', onLoad);
        
        // Trigger loading for data-src images
        if (image.getAttribute('data-src') && !image.src) {
          image.src = image.getAttribute('data-src')!;
        }
        
        // Fallback timeout
        setTimeout(() => {
          resolve(null);
          image.removeEventListener('load', onLoad);
          image.removeEventListener('error', onLoad);
        }, 2000);
      });
    });

    // Wait for React Suspense components to load
    const suspenseElements = document.querySelectorAll('[data-testid*="suspense"], .suspense-loading');
    if (suspenseElements.length > 0) {
      // Wait a bit longer for Suspense components
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await Promise.all(imagePromises);
    
    // Additional wait for any remaining dynamic content
    await new Promise(resolve => setTimeout(resolve, 300));
  };

  const captureAndOpen = async () => {
    try {
      setIsOpen(false);
      
      // Wait for modal to close and DOM to settle
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Wait for all lazy content to load
      await waitForLazyContent();
      
      const root = document.getElementById("root");
      if (!root) throw new Error("Root element not found");
      
      // Check if root has proper dimensions
      const rootRect = root.getBoundingClientRect();
      if (rootRect.width === 0 || rootRect.height === 0) {
        throw new Error("Root element has zero dimensions");
      }

      // Take screenshot with modern-screenshot
      const dataUrl = await domToPng(root, {
        width: Math.max(rootRect.width, 800),
        height: Math.max(rootRect.height, 600),
        scale: 0.8,
        backgroundColor: '#ffffff',
        // Filter out problematic elements
        filter: (node) => {
          const element = node as HTMLElement;
          
          // Skip modal and overlay elements
          if (element.classList?.contains('modal') ||
              element.classList?.contains('fixed') ||
              element.classList?.contains('absolute') ||
              element.style?.position === 'fixed' ||
              element.style?.zIndex === '9999') {
            return false;
          }
          
          // Skip canvas elements with zero dimensions
          if (element.tagName === 'CANVAS') {
            const canvas = element as HTMLCanvasElement;
            if (canvas.width === 0 || canvas.height === 0) {
              return false;
            }
          }
          
          // Skip elements with zero dimensions
          const rect = element.getBoundingClientRect?.();
          if (rect && rect.width === 0 && rect.height === 0) {
            return false;
          }
          
          // Skip video elements (can cause issues)
          if (element.tagName === 'VIDEO') {
            return false;
          }
          
          return true;
        },
        // Additional options for better rendering
        style: {
          // Ensure proper text rendering
          'font-family': 'system-ui, -apple-system, sans-serif',
          // Fix for some CSS issues
          'box-sizing': 'border-box'
        }
      });
      
      // Convert data URL to File
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error("Generated screenshot is empty");
      }
      
      const file = new File([blob], "screenshot.png", { type: "image/png" });
      setScreenshot(file);
      
    } catch (error) {
      console.error("Screenshot failed:", error);
      setScreenshot(null);
      // Still open modal even if screenshot fails
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
