import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowLeft, User, Calendar } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import HorizontalRule from "@tiptap/extension-horizontal-rule";

interface ArticleOverlayProps {
  canvasId: string;
  onClose: () => void;
}

const ArticleOverlay: React.FC<ArticleOverlayProps> = ({ canvasId, onClose }) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Image.configure({ inline: true }),
      HorizontalRule,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-400 underline cursor-pointer',
        },
      }),
    ],
    content: null,
    editorProps: {
      attributes: {
        // Matches editor exactly
        class: 'tiptap prose prose-invert max-w-none focus:outline-none min-h-[400px]',
      },
    },
  });

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${BACKEND_URL}/api/articles/${canvasId}`)
      .then((res) => {
        setArticle(res.data);
        if (editor && res.data.content) {
          editor.commands.setContent(res.data.content);
        }
      })
      .catch(err => console.error("Fetch error:", err))
      .finally(() => setLoading(false));
  }, [canvasId, editor, BACKEND_URL]);
  console.log("Article:", article);
  if (loading) return (
    <div className="min-h-screen bg-[#191919] flex items-center justify-center">
      <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!article) return <div className="bg-[#191919] min-h-screen text-red-400 p-10">Article not found</div>;

  return (
    <div className="min-h-screen bg-[#191919] text-gray-100 font-sans pb-20 overflow-y-auto">
      {/* Sticky Back Button - Positioned to not disrupt the layout flow */}
      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={onClose}
          className="p-3 bg-[#252525] border border-white/10 rounded-full text-gray-400 hover:text-white transition-all shadow-xl"
        >
          <ArrowLeft size={20} />
        </button>
      </div>
      {/* Main Container: Matches <div className="max-w-5xl mx-auto px-6 py-10 flex gap-10"> */}
      <div className="max-w-5xl mx-auto px-6 py-10 flex gap-10">

        {/* Left Side Spacer: Mirrors the <aside> width from your Editor */}
        <aside className="shrink-0 w-[52px] hidden lg:block">
          {/* Empty to preserve the gap/offset */}
        </aside>

        {/* Right Side: Matches <div className="flex-1 max-w-3xl space-y-12"> */}
        <div className="flex-1 max-w-3xl space-y-12">

          {/* --- TITLE CARD (HEADER) --- */}
          <header
            className={`relative overflow-hidden rounded-3xl p-10 shadow-2xl border transition-all duration-500 ${article.hero_image_url ? 'border-transparent' : 'bg-[#222222] border-white/5'
              }`}
          >
            {/* Background Image Logic - Exact Mirror */}
            {article.hero_image_url && (
              <>
                <img
                  src={article.hero_image_url}
                  alt="Cover"
                  className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/60 z-10" />
              </>
            )}

            <div className="relative z-20 space-y-6">
              <div className="flex justify-between items-start gap-4">
                {/* TITLE: Using 5xl, font-black, and tracking-tighter to match 
         the input in your editor exactly. 
      */}
                <h1 className="w-full bg-transparent text-5xl font-black text-white tracking-tighter leading-tight">
                  {article.title}
                </h1>
              </div>

              {/* subtitle: Added 'min-h-[3rem]' and 'leading-relaxed' to mirror 
       the height of the 2-row textarea in the editor. 
    */}
              <p className={`w-full bg-transparent text-xl leading-relaxed min-h-[3rem] ${article.hero_image_url ? 'text-gray-200' : 'text-gray-400'
                }`}>
                {article.subtitle}
              </p>

              <div className={`flex flex-wrap items-center gap-6 pt-4 border-t ${article.hero_image_url ? 'border-white/10' : 'border-white/5'
                }`}>
                <div className={`flex items-center gap-2 text-sm ${article.hero_image_url ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                  <Calendar size={16} />
                  <span>
                    {new Date(article.publishedAt || Date.now()).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* --- EDITOR CONTENT CARD (MIRRORED GAP) --- */}
          <div className="pt-6">
            <div className="flex items-center gap-4 mb-8">
              <User size={16} className="text-blue-500" />
              <span className="text-blue-500 font-semibold tracking-tight">
                By {article.author_name || 'Anonymous'}
              </span>
            </div>

            <main className="relative">
              {/* This renders exactly as it did in the editor */}
              <EditorContent editor={editor} />
            </main>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ArticleOverlay;