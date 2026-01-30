import { useMemo } from "react";
import { usePublishedArticles } from "../../context/PublishedArticleContext";

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
      .filter(a => a._id !== currentCanvasId)
      .slice(0, 6);
  }, [articles, currentCanvasId]);

  if (loading || recommendations.length === 0) return null;

  return (
    <aside className="w-full max-w-[300px] py-6 px-4 border-l border-gray-100 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
          Unexplored
        </h3>
        <div className="h-[1px] flex-grow ml-4 bg-gray-100 dark:bg-zinc-800" />
      </div>

      <div className="flex flex-col gap-8">
        {recommendations.map((article, index) => (
          <div
            key={article._id}
            onClick={() => onOpenArticle(article._id)}
            className="group cursor-pointer flex flex-col gap-3 relative"
          >
            {/* Optional: Numbering for an editorial look */}
            <span className="absolute -left-6 top-0 text-xs font-mono text-zinc-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
              0{index + 1}
            </span>

            <div className="flex gap-4">
              {article.hero_image_url && (
                <div className="relative overflow-hidden rounded-md w-20 h-20 flex-shrink-0">
                  <img
                    src={article.hero_image_url}
                    alt={article.title}
                    className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                  />
                </div>
              )}

              <div className="flex flex-col py-1">
                <p className="text-[14px] leading-snug font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-2 group-hover:text-purple-500 transition-colors">
                  {article.title}
                </p>
                
                <div className="mt-auto flex items-center gap-2">
                  {article.author_name && (
                    <span className="text-[11px] font-medium text-zinc-400 truncate">
                      By {article.author_name}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-300">•</span>
                  <span className="text-[10px] text-zinc-400">5 min read</span>
                </div>
              </div>
            </div>
            
            {/* Subtle bottom border that expands on hover */}
            <div className="h-[1px] w-full bg-gray-50 dark:bg-zinc-900 mt-2 relative overflow-hidden">
               <div className="absolute inset-0 bg-purple-500 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ArticleRecommendations;