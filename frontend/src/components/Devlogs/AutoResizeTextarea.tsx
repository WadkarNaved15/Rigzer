import React, { useRef, useEffect } from "react";

// Define the props interface for the component
interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
   placeholder?: string;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value,
  onChange,
  className = "",
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // reset height
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      className={`resize-none overflow-hidden ${className}`}
      value={value}
      onChange={onChange}
    />
  );
};
export default AutoResizeTextarea;