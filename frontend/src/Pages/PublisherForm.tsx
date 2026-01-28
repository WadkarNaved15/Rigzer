import { useState} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
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
  Unlink,
  Check,
  X
} from 'lucide-react';


export default function ArticleEditor() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [headerImage, setHeaderImage] = useState<string>('');

  // Custom Link State
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [currentDate] = useState(new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Image.configure({ inline: true, allowBase64: false }),
      HorizontalRule,
      Placeholder.configure({ placeholder: 'Tell your story...' }),
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

  // Handle Link Submission
  const handleLinkConfirm = () => {
    if (linkUrl) {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkUrl('');
    setShowLinkInput(false);
  };
  const handlePublish = async () => {
    if (!editor || editor.isEmpty || !title.trim()) return;
    setPublishing(true);
    try {
      const payload = {
        title,
        description,
        author_name: author,
        content: editor.getJSON(), // TipTap JSON
        headerImage,
      };
      console.log("Payload:", payload);

      const res = await fetch(`${BACKEND_URL}/api/articles/publish`, {
        method: "POST",
        credentials: "include", // IMPORTANT (auth)
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Publish failed");
      const data = await res.json();
      console.log("Article published:", data);

    } catch (err) {
      console.error(err);
    }
    finally {
      setPublishing(false);
    }
  };

  const handleImageInsert = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        // 1️⃣ Get presigned URL
        const res = await fetch(`${BACKEND_URL}/api/upload/presigned-url`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            category: "image",
          }),
        });

        if (!res.ok) throw new Error("Failed to get upload URL");
        const { uploadUrl, fileUrl } = await res.json();

        // 2️⃣ Upload to S3
        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        // 3️⃣ Insert CloudFront URL into editor
        editor
          ?.chain()
          .focus()
          .setImage({ src: fileUrl })
          .run();
      } catch (err) {
        console.error("Image upload failed", err);
      }
    };

    input.click();
  };
  const handleCoverUpload = async (file: File) => {
    const res = await fetch(`${BACKEND_URL}/api/upload/presigned-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        category: "image",
      }),
    });

    if (!res.ok) throw new Error("Failed to get upload URL");
    const { uploadUrl, fileUrl } = await res.json();

    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    setHeaderImage(fileUrl); // ✅ store CloudFront URL
  };


  if (!editor) return null;

  return (
    <div className="min-h-screen bg-[#191919] text-gray-100 font-sans pb-20">
      <div className="max-w-5xl mx-auto px-6 py-10 flex gap-10">

        {/* --- LEFT SIDE: FLOATING TOOLBAR --- */}
        <aside className="shrink-0 relative">
          <div className="sticky top-10 flex flex-col gap-3 p-2 bg-[#252525] border border-white/10 rounded-2xl shadow-xl z-20">
            <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} icon={<Type size={18} />} label="Text" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={<Bold size={18} />} label="Bold" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={<Italic size={18} />} label="Italic" />

            <div className="h-px bg-white/10 mx-2 my-1" />

            {/* Custom Link Logic */}
            <div className="relative">
              <ToolbarButton
                onClick={() => {
                  setLinkUrl(editor.getAttributes('link').href || '');
                  setShowLinkInput(!showLinkInput);
                }}
                active={editor.isActive('link')}
                icon={<LinkIcon size={18} />}
                label="Add Link"
              />

              {/* --- PRODUCTION LINK POPUP --- */}
              {showLinkInput && (
                <div className="absolute left-16 top-0 w-64 p-3 bg-[#2a2a2a] border border-white/10 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-left-2">
                  <div className="flex flex-col gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Paste or type link..."
                      className="w-full bg-[#191919] border border-white/5 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLinkConfirm()}
                    />
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setShowLinkInput(false)} className="p-1.5 hover:bg-white/5 rounded-md text-gray-400"><X size={16} /></button>
                      <button onClick={handleLinkConfirm} className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-white"><Check size={16} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {editor.isActive('link') && (
              <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} icon={<Unlink size={18} />} label="Remove Link" />
            )}

            <div className="h-px bg-white/10 mx-2 my-1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={<Heading1 size={18} />} label="Heading 1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={<Heading2 size={18} />} label="Heading 2" />
            <div className="h-px bg-white/10 mx-2 my-1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={<List size={18} />} label="Bullets" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={<ListOrdered size={18} />} label="Numbered" />
            <div className="h-px bg-white/10 mx-2 my-1" />
            <ToolbarButton onClick={handleImageInsert} icon={<ImagePlus size={18} />} label="Insert Image" />
            <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={<Minus size={18} />} label="Divider" />
          </div>
        </aside>

        {/* --- RIGHT SIDE: UNIFIED VERTICAL CONTENT --- */}
        <div className="flex-1 max-w-3xl space-y-12">
          <header className="bg-[#222222] border border-white/5 rounded-3xl p-10 shadow-2xl">
            <div className="space-y-6">
              <input
                type="text"
                placeholder="Article Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-5xl font-black border-none outline-none placeholder:text-gray-700 text-white tracking-tighter"
              />
              <textarea
                placeholder="Write a brief, catchy description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent text-xl text-gray-400 border-none outline-none resize-none placeholder:text-gray-700 leading-relaxed"
                rows={2}
              />
              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <User size={16} className="text-blue-500" />
                  <input type="text" placeholder="Author Name" value={author} onChange={(e) => setAuthor(e.target.value)} className="bg-transparent border-none outline-none focus:text-white transition-colors" />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar size={16} />
                  <span>{currentDate}</span>
                </div>
              </div>
            </div>
          </header>

          <section>
            {headerImage ? (
              <div className="relative group overflow-hidden rounded-2xl border border-white/10">
                <img src={headerImage} alt="Cover" className="w-full h-[450px] object-cover transition-transform duration-700 group-hover:scale-105" />
                <button onClick={() => setHeaderImage('')} className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold">Change Cover</button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/10 rounded-2xl p-20 text-center hover:border-blue-500/50 hover:bg-white/[0.02] transition-all group cursor-pointer" onClick={() => document.getElementById('header-upload')?.click()}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && handleCoverUpload(e.target.files[0])}
                  className="hidden"
                  id="header-upload"
                />

                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-[#252525] rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600/10 transition-colors">
                    <ImagePlus className="w-8 h-8 text-gray-500 group-hover:text-blue-400" />
                  </div>
                  <span className="text-gray-400 font-medium">Upload high-resolution cover image</span>
                </div>
              </div>
            )}
          </section>

          <main className="relative">
            <EditorContent editor={editor} />
            <div className="mt-20 pt-10 border-t border-white/10 flex justify-end">
              <button
                onClick={handlePublish}
                className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-3.5 rounded-full font-bold transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-20 active:scale-95"
                disabled={publishing || !title.trim() || editor.isEmpty}
              >
                {publishing ? "Publishing..." : "Publish Article"}
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
      className={`p-3 rounded-xl transition-all duration-200 group relative ${active
        ? 'bg-blue-600 text-white shadow-lg'
        : 'text-gray-500 hover:bg-[#323232] hover:text-gray-200'
        }`}
    >
      {icon}
      <span className="absolute left-16 bg-black text-white text-[11px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-white/10 shadow-xl transition-opacity z-50">
        {label}
      </span>
    </button>
  );
}