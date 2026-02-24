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
      .slice(0, 15); 
  }, [articles, currentCanvasId]);

  if (loading || recommendations.length === 0) return null;

  return (
    <aside className="flex flex-col h-full max-h-screen bg-[#F3F4F6] dark:bg-[#191919] border-l border-gray-200 dark:border-[#252525] transition-colors duration-300">
      
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-[#F3F4F6] dark:bg-[#191919] flex items-center justify-between p-4 border-b border-purple-600/50 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
          Unexplored
        </h2>
        <span className="text-[10px] bg-purple-600/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold">
          {recommendations.length} NEW
        </span>
      </div>

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin scrollbar-thumb-purple-600/20 hover:scrollbar-thumb-purple-600/40">
        {recommendations.map((article) => (
          <div
            key={article._id}
            onClick={() => onOpenArticle(article._id)}
            className="group cursor-pointer flex flex-col space-y-3"
          >
            {/* Thumbnail Container */}
            <div className="relative aspect-video w-full bg-gray-200 dark:bg-[#111] rounded-xl overflow-hidden border border-gray-200 dark:border-white/5 shadow-sm transition-all duration-300 group-hover:border-purple-500/50 group-hover:shadow-lg group-hover:shadow-purple-500/10">
              {article.hero_image_url ? (
                <img
                  src={article.hero_image_url}
                  alt={article.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-400 dark:text-[#444] bg-gray-100 dark:bg-[#1a1a1a]">
                  <PlusCircle size={18} className="mb-2 opacity-40" />
                  <span className="text-[10px] uppercase tracking-tighter">No Preview</span>
                </div>
              )}
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                 <span className="text-white text-[10px] font-bold flex items-center gap-1">
                   READ ARTICLE <ArrowRight size={10} />
                 </span>
              </div>
            </div>

            {/* Content info */}
            <div className="px-1">
              <h3 className="text-sm font-semibold leading-snug text-gray-800 dark:text-zinc-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
                {article.title}
              </h3>
              
              <div className="mt-2 flex items-center justify-between">
                {article.author_name && (
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                    {article.author_name}
                  </p>
                )}
                <div className="h-1.5 w-1.5 rounded-full bg-purple-500 scale-0 group-hover:scale-100 transition-transform" />
              </div>
            </div>
          </div>
        ))}
        <div className="h-20 w-full flex-shrink-0" aria-hidden="true" />
      </div>
    </aside>
  );
};

export default ArticleRecommendations;