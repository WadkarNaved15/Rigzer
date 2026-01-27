import { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link'; // 1. Import Link extension
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  ImagePlus,
  Minus,
  List,
  ListOrdered,
  Type,
  User,
  Calendar,
  Link as LinkIcon,
  Unlink
} from 'lucide-react';

interface ArticleEditorProps {
  onPublish: (data: any) => void;
}

export default function ArticleEditor({ onPublish }: ArticleEditorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [headerImage, setHeaderImage] = useState<string>('');
  const [currentDate] = useState(new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Image.configure({ inline: true, allowBase64: true }),
      HorizontalRule,
      Placeholder.configure({ placeholder: 'Tell your story...' }),
      // 2. Configure Link extension
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-400 underline cursor-pointer',
        },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-invert max-w-none focus:outline-none min-h-[400px]',
      },
    },
  });

  // 3. Link Insertion Logic
  const setLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter the URL', previousUrl);

    // Cancelled
    if (url === null) return;

    // Empty string = remove link
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // Set link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const handleImageInsert = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        editor?.chain().focus().setImage({ src: URL.createObjectURL(file) }).run();
      }
    };
    input.click();
  };

  if (!editor) return null;

  return (
    <div className="min-h-screen bg-[#191919] text-gray-100 font-sans pb-20">
      <div className="max-w-5xl mx-auto px-6 py-10 flex gap-10">
        
        {/* --- LEFT SIDE: FLOATING TOOLBAR --- */}
        <aside className="shrink-0">
          <div className="sticky top-10 flex flex-col gap-3 p-2 bg-[#252525] border border-[var(--color-border)] rounded-2xl shadow-xl z-10">
            <ToolbarButton 
              onClick={() => editor.chain().focus().setParagraph().run()} 
              active={editor.isActive('paragraph')} 
              icon={<Type size={18} />} 
              label="Text" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleBold().run()} 
              active={editor.isActive('bold')} 
              icon={<Bold size={18} />} 
              label="Bold" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleItalic().run()} 
              active={editor.isActive('italic')} 
              icon={<Italic size={18} />} 
              label="Italic" 
            />
            
            <div className="h-px bg-[var(--color-border)] mx-2 my-1" />
            
            {/* Link Buttons */}
            <ToolbarButton 
              onClick={setLink} 
              active={editor.isActive('link')} 
              icon={<LinkIcon size={18} />} 
              label="Add Link" 
            />
            {editor.isActive('link') && (
              <ToolbarButton 
                onClick={() => editor.chain().focus().unsetLink().run()} 
                icon={<Unlink size={18} />} 
                label="Remove Link" 
              />
            )}

            <div className="h-px bg-[var(--color-border)] mx-2 my-1" />
            
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
              active={editor.isActive('heading', { level: 1 })} 
              icon={<Heading1 size={18} />} 
              label="Large Heading" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
              active={editor.isActive('heading', { level: 2 })} 
              icon={<Heading2 size={18} />} 
              label="Small Heading" 
            />

            <div className="h-px bg-[var(--color-border)] mx-2 my-1" />

            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleBulletList().run()} 
              active={editor.isActive('bulletList')} 
              icon={<List size={18} />} 
              label="Bullets" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleOrderedList().run()} 
              active={editor.isActive('orderedList')} 
              icon={<ListOrdered size={18} />} 
              label="Numbered" 
            />

            <div className="h-px bg-[var(--color-border)] mx-2 my-1" />

            <ToolbarButton onClick={handleImageInsert} icon={<ImagePlus size={18} />} label="Insert Image" />
            <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={<Minus size={18} />} label="Divider" />
          </div>
        </aside>

        {/* --- RIGHT SIDE: UNIFIED VERTICAL CONTENT --- */}
        <div className="flex-1 max-w-3xl space-y-12">
          <header className="bg-[#222222] border border-[var(--color-border)] rounded-3xl p-10 shadow-2xl animate-fade-in">
            <div className="space-y-6">
              <input
                type="text"
                placeholder="Article Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-5xl font-black border-none outline-none placeholder:text-gray-600 text-white tracking-tighter"
              />
              <textarea
                placeholder="Write a brief, catchy description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent text-xl text-[var(--color-text-secondary)] border-none outline-none resize-none placeholder:text-gray-600 leading-relaxed"
                rows={2}
              />
              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <User size={16} className="text-blue-500" />
                  <input 
                    type="text" 
                    placeholder="Author Name" 
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="bg-transparent border-none outline-none focus:text-white transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <Calendar size={16} />
                  <span>{currentDate}</span>
                </div>
              </div>
            </div>
          </header>

          <section>
            {headerImage ? (
              <div className="relative group overflow-hidden rounded-2xl border border-[var(--color-border)]">
                <img src={headerImage} alt="Cover" className="w-full h-[450px] object-cover transition-transform duration-700 group-hover:scale-105" />
                <button onClick={() => setHeaderImage('')} className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold">Change Cover</button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-[var(--color-border)] rounded-2xl p-20 text-center hover:border-blue-500/50 hover:bg-white/[0.02] transition-all group">
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setHeaderImage(URL.createObjectURL(e.target.files[0]))} className="hidden" id="header-upload" />
                <label htmlFor="header-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 bg-[#252525] rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600/10 transition-colors">
                    <ImagePlus className="w-8 h-8 text-gray-500 group-hover:text-blue-400" />
                  </div>
                  <span className="text-gray-400 font-medium">Upload high-resolution cover image</span>
                </label>
              </div>
            )}
          </section>

          <main className="relative">
            <EditorContent editor={editor} />
            <div className="mt-20 pt-10 border-t border-[var(--color-border)] flex justify-end">
              <button 
                 onClick={() => onPublish({ title, description, author, date: currentDate, content: editor.getJSON(), headerImage })}
                 className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-3.5 rounded-full font-bold transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-20 active:scale-95"
                 disabled={!title.trim() || editor.isEmpty}
              >
                  Publish Article
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, active = false, icon, label }: { onClick: () => void, active?: boolean, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl transition-all duration-200 group relative ${
        active 
          ? 'bg-blue-600 text-white shadow-lg' 
          : 'text-gray-500 hover:bg-[#323232] hover:text-gray-200'
      }`}
    >
      {icon}
      <span className="absolute left-16 bg-black text-white text-[11px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-[var(--color-border)] shadow-xl transition-opacity z-50">
        {label}
      </span>
    </button>
  );
}