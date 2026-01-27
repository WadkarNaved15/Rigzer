import { useRef, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Minus,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  onRequestLinkInsert?: (insertLink: (text: string, url: string) => void) => void;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  style,
  className = '',
  onRequestLinkInsert,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });

  /* 🔄 Keep editor DOM in sync with value */
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setShowToolbar(false);
      return;
    }

    const range = selection.getRangeAt(0);
    savedRangeRef.current = range;

    const rect = range.getBoundingClientRect();
    setToolbarPosition({
      top: rect.top - 45,
      left: rect.left + rect.width / 2,
    });

    setShowToolbar(true);
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    if (selection && savedRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
  };

  const applyFormat = (command: string, value?: string) => {
    restoreSelection();
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertHorizontalRule = () => {
    restoreSelection();
    document.execCommand('insertHorizontalRule');
    handleInput();
  };

  const insertLink = (text: string, url: string) => {
    restoreSelection();
    document.execCommand(
      'insertHTML',
      false,
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`
    );
    editorRef.current?.focus();
    handleInput();
  };

  return (
    <div className="relative">
      {showToolbar && (
        <div
          className="fixed z-[300] flex items-center gap-1 bg-[#1A1A1A] border border-[rgba(255,255,255,0.2)] rounded-lg px-2 py-1.5 shadow-xl transform -translate-x-1/2"
          style={{
            top: toolbarPosition.top,
            left: toolbarPosition.left,
          }}
        >
          <ToolbarButton onClick={() => applyFormat('bold')} title="Bold">
            <Bold size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => applyFormat('italic')} title="Italic">
            <Italic size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => applyFormat('strikeThrough')} title="Strikethrough">
            <Strikethrough size={14} />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => applyFormat('insertUnorderedList')} title="Bullet List">
            <List size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => applyFormat('insertOrderedList')} title="Numbered List">
            <ListOrdered size={14} />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => {
              if (onRequestLinkInsert) {
                onRequestLinkInsert(insertLink);
              }
            }}
            title="Insert Link"
          >
            <LinkIcon size={14} />
          </ToolbarButton>

          <ToolbarButton onClick={insertHorizontalRule} title="Horizontal Rule">
            <Minus size={14} />
          </ToolbarButton>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onMouseUp={handleSelection}
        onKeyUp={handleSelection}
        className={`w-full bg-transparent border-none outline-none min-h-[100px] ${className}`}
        style={style}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}

/* 🔹 Small helper components */

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="p-1.5 hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors text-[#EEEEEE]"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-[rgba(255,255,255,0.2)] mx-1" />;
}
