import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowLeft, User, Calendar } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useNavigate, useParams } from "react-router-dom";
import Link from "@tiptap/extension-link";
import HorizontalRule from "@tiptap/extension-horizontal-rule";

interface ArticleOverlayProps {
  canvasId: string;
  onClose: () => void;
}

const ArticleOverlay: React.FC = () => {
  const { canvasId } = useParams();
  const navigate = useNavigate();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  // --- Reading Progress Logic ---
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;
      if (totalHeight > 0) {
        setProgress((currentScroll / totalHeight) * 100);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Image.configure({ inline: true }),
      HorizontalRule,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-500 dark:text-blue-400 underline cursor-pointer',
        },
      }),
    ],
    content: null,
    // Inside useEditor hooks
editorProps: {
  attributes: {
    // 1. Removed 'prose-slate' to use custom high-contrast overrides
    // 2. Added 'prose-lg' to increase base readability
    // 3. Forced text-slate-900 for light mode body text
    class: 'tiptap prose prose-lg max-w-none focus:outline-none min-h-[400px] text-slate-900 dark:text-gray-100 dark:prose-invert prose-headings:text-slate-950 dark:prose-headings:text-white prose-p:leading-relaxed prose-p:text-slate-800 dark:prose-p:text-gray-300',
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

  if (loading) return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#191919] flex items-center justify-center">
      <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!article) return <div className="bg-[#F3F4F6] dark:bg-[#191919] min-h-screen text-red-500 dark:text-red-400 p-10">Article not found</div>;

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#191919] text-gray-900 dark:text-gray-100 font-sans pb-20 overflow-y-auto transition-colors duration-300">

      {/* 🚀 READING PROGRESS BAR */}
      <div className="fixed top-0 left-0 w-full h-1 z-[100] bg-transparent">
        <div 
          className="h-full bg-purple-600 transition-all duration-150 ease-out shadow-[0_0_10px_rgba(147,51,234,0.5)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={() => navigate(-1)}
          className="p-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-xl"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#191919] text-gray-900 dark:text-gray-100 font-sans pb-20 overflow-y-auto transition-colors duration-300">
  {/* ... Sticky Back Button ... */}

  <div className="flex justify-center px-4">
    <div className="flex-1 max-w-3xl space-y-12">
      
      <header
        className={`relative overflow-hidden rounded-3xl p-10 shadow-2xl border transition-all duration-500 flex flex-col justify-center ${
          article.hero_image_url 
            ? 'border-transparent' 
            // In light mode, the card is solid white against the #F3F4F6 background
            : 'bg-white dark:bg-[#222222] border-gray-200 dark:border-white/5'
        }`}
        style={{ minHeight: '303.4px' }}
      >
        {article.hero_image_url && (
          <>
            <img src={article.hero_image_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover z-0" />
            {/* Dark overlay for image ensures white text is always readable */}
            <div className="absolute inset-0 bg-black/50 dark:bg-black/70 z-10" />
          </>
        )}

        <div className="relative z-20 space-y-6 flex-1 flex flex-col justify-between">
          <div className="space-y-6">
            <h1 className={`w-full bg-transparent text-5xl font-black tracking-tighter leading-[1.1] ${
              // If there's an image, text is always white. 
              // If no image, text is dark gray in light mode, white in dark mode.
              article.hero_image_url ? 'text-white' : 'text-slate-900 dark:text-white'
            }`}>
              {article.title}
            </h1>

            <p className={`w-full bg-transparent text-xl leading-relaxed ${
              article.hero_image_url 
                ? 'text-gray-100' 
                : 'text-slate-600 dark:text-gray-400'
            }`}>
              {article.subtitle}
            </p>
          </div>

          <div className={`flex flex-wrap items-center gap-6 pt-4 border-t ${
            article.hero_image_url ? 'border-white/20' : 'border-slate-200 dark:border-white/5'
          }`}>
            <div className={`flex items-center gap-2 text-sm ${
              article.hero_image_url ? 'text-gray-200' : 'text-slate-500 dark:text-gray-400'
            }`}>
              <Calendar size={16} />
              <span>{/* Date Logic */}</span>
            </div>
          </div>
        </div>
      </header>

      {/* --- Main Content Section --- */}
      <div className="pt-6">
        <div className="flex items-center gap-4 mb-8">
          <User size={16} className="text-blue-700 dark:text-blue-500" />
          <span className="text-blue-700 dark:text-blue-500 font-bold tracking-tight">
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
    </div>
  );
};

export default ArticleOverlay;