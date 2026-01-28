import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
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
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Read-only editor
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      HorizontalRule,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: "text-blue-400 underline",
        },
      }),
    ],
    content: article?.content ?? null,
  });

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${BACKEND_URL}/api/articles/${canvasId}`)
      .then((res) => setArticle(res.data))
      .finally(() => setLoading(false));
  }, [canvasId]);

  // Update editor when article loads
  useEffect(() => {
    if (editor && article?.content) {
      editor.commands.setContent(article.content);
    }
  }, [editor, article]);

  if (loading) {
    return <div className="text-center text-gray-400">Loading article…</div>;
  }

  if (!article) {
    return <div className="text-center text-red-400">Article not found</div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-[#151515] rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#151515] border-b border-black/5 dark:border-white/5 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-purple-500"
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      {/* Hero Image */}
      {article.hero_image_url && (
        <div className="w-full aspect-[16/9] overflow-hidden">
          <img
            src={article.hero_image_url}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="px-6 sm:px-10 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
          {article.title}
        </h1>

        {article.subtitle && (
          <p className="mt-3 text-gray-600 dark:text-gray-400 text-base">
            {article.subtitle}
          </p>
        )}

        <div className="mt-4 text-xs uppercase tracking-wider text-gray-500">
          By {article.author_name} •{" "}
          {new Date(article.publishedAt).toLocaleDateString()}
        </div>

        {/* Divider */}
        <div className="mt-6 mb-8 h-px bg-black/10 dark:bg-white/10" />

        {/* TipTap Content */}
        <EditorContent
          editor={editor}
          className="prose prose-lg dark:prose-invert max-w-none"
        />
      </div>
    </div>
  );
};

export default ArticleOverlay;
