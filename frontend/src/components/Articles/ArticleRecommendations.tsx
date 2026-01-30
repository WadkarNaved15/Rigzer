import { useMemo } from "react";
import { usePublishedArticles } from "../../context/PublishedArticleContext";
import { PlusCircle, ArrowRight } from "lucide-react";

interface Props {
  currentCanvasId: string;
  onOpenArticle: (id: string) => void;
}

const ArticleRecommendations: React.FC<Props> = ({
  currentCanvasId,
  onOpenArticle,
}) => {
  const { articles, loading } = usePublishedArticles();

  const recommendations = useMemo(() => {
    return articles
      .filter((a) => a._id !== currentCanvasId)
      .slice(0, 6);
  }, [articles, currentCanvasId]);

  if (loading || recommendations.length === 0) return null;

  return (
    <aside className="flex flex-col h-full bg-white dark:bg-[#191919] border-l border-gray-100 dark:border-[#252525]">
      {/* Header - Matching your Billboard style */}
      <div className="flex items-center justify-between p-4 border-b border-purple-600 dark:border-gray-700">
        <h2 className="text-sm font-bold dark:text-white uppercase tracking-widest">
          Unexplored
        </h2>
        <span className="text-[10px] bg-purple-600/10 text-purple-500 px-2 py-0.5 rounded-full font-bold">
          {recommendations.length} NEW
        </span>
      </div>

      {/* Structured 2D List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
        {recommendations.map((article) => (
          <div
            key={article._id}
            onClick={() => onOpenArticle(article._id)}
            className="group cursor-pointer flex flex-col space-y-3"
          >
            {/* Thumbnail Container */}
            <div className="relative aspect-video w-full bg-[#111] rounded-xl overflow-hidden border border-white/5 shadow-sm transition-all duration-300 group-hover:border-purple-500/50 group-hover:shadow-lg group-hover:shadow-purple-500/10">
              {article.hero_image_url ? (
                <img
                  src={article.hero_image_url}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#444] bg-[#1a1a1a]">
                  <PlusCircle size={18} className="mb-2 opacity-20" />
                  <span className="text-[10px] uppercase tracking-tighter">No Preview</span>
                </div>
              )}
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                 <span className="text-white text-[10px] font-bold flex items-center gap-1">
                    READ ARTICLE <ArrowRight size={10} />
                 </span>
              </div>
            </div>

            {/* Content info */}
            <div className="px-1">
              <h3 className="text-sm font-semibold leading-snug dark:text-zinc-200 group-hover:text-purple-400 transition-colors line-clamp-2">
                {article.title}
              </h3>
              
              <div className="mt-2 flex items-center justify-between">
                {article.author_name && (
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                    {article.author_name}
                  </p>
                )}
                <div className="h-1 w-1 rounded-full bg-purple-500 scale-0 group-hover:scale-100 transition-transform" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer / CTA */}
      <div className="p-4 bg-gray-50 dark:bg-[#151515] border-t border-gray-100 dark:border-[#252525]">
        <button className="w-full py-2 text-[11px] font-bold text-gray-400 hover:text-purple-500 uppercase tracking-widest transition-colors">
          View All Library
        </button>
      </div>
    </aside>
  );
};

export default ArticleRecommendations;