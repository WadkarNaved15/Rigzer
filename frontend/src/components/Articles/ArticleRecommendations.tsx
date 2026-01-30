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
    <aside className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
        Unexplored
      </h3>

      <div className="space-y-4">
        {recommendations.map(article => (
          <div
            key={article._id}
            onClick={() => onOpenArticle(article._id)}
            className="group cursor-pointer flex gap-3"
          >
            {article.hero_image_url && (
              <img
                src={article.hero_image_url}
                alt={article.title}
                className="w-16 h-20 rounded-lg object-cover flex-shrink-0"
              />
            )}

            <div className="flex flex-col justify-between">
              <p className="text-sm font-medium line-clamp-2 group-hover:text-purple-400 transition-colors">
                {article.title}
              </p>

              {article.author_name && (
                <span className="text-xs text-gray-500">
                  {article.author_name}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ArticleRecommendations;
