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
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
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
      .finally(() => setLoading(false));
  }, [canvasId, editor]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#191919] flex items-center justify-center text-gray-400">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) return <div className="text-center text-red-400 p-10">Article not found</div>;

  return (
    <div className="min-h-screen bg-[#191919] text-gray-100 font-sans pb-20 overflow-y-auto">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-[#191919]/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          Back to feed
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 flex gap-10">
        {/* --- LEFT SIDE: PLACEHOLDER (To match Editor Layout) --- */}
        <aside className="shrink-0 w-[52px] hidden lg:block">
           {/* Empty but preserves the same "centered" look as the editor */}
        </aside>

        <div className="flex-1 max-w-3xl space-y-12">
          {/* --- MATCHING HEADER STYLE --- */}
          <header className="relative overflow-hidden rounded-3xl p-10 shadow-2xl border border-transparent">
            {article.hero_image_url && (
              <>
                <img
                  src={article.hero_image_url}
                  alt="Cover"
                  className="absolute inset-0 w-full h-full object-cover z-0"
                />
                <div className="absolute inset-0 bg-black/60 z-10" />
              </>
            )}

            <div className="relative z-20 space-y-6">
              <h1 className="text-5xl font-black text-white tracking-tighter leading-tight">
                {article.title}
              </h1>

              {article.subtitle && (
                <p className="text-xl text-gray-200 leading-relaxed">
                  {article.subtitle}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar size={16} />
                  <span>{new Date(article.publishedAt).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}</span>
                </div>
              </div>
            </div>
          </header>

          {/* --- ARTICLE CONTENT --- */}
          <div className="pt-6">
            <div className="flex items-center gap-4 mb-8">
              <User size={16} className="text-blue-500" />
              <span className="text-blue-500 font-semibold tracking-tight">
                By {article.author_name || 'Anonymous'}
              </span>
            </div>

            <main className="relative">
              <EditorContent editor={editor} />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticleOverlay;