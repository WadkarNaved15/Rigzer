// src/components/CodeEditor.tsx
import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

interface CodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  height?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  height = "300px",
}) => {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-700">
      <CodeMirror
        value={value}
        height={height}
        theme={oneDark}
        extensions={[javascript({ jsx: false })]}
        onChange={(val) => onChange(val)}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          foldGutter: true,
          bracketMatching: true,
        }}
      />
    </div>
  );
};

export default CodeEditor;
