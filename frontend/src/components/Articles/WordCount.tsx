interface WordCountProps {
  content: Array<{ type: string; content: string }>;
}

export default function WordCount({ content }: WordCountProps) {
  const countWords = () => {
    const textBlocks = content.filter(
      (block) => block.type === 'paragraph' || block.type === 'heading' || block.type === 'blockquote'
    );

    const allText = textBlocks.map((block) => block.content).join(' ');
    const words = allText.trim().split(/\s+/).filter((word) => word.length > 0);

    return words.length;
  };

  const wordCount = countWords();
  const formattedCount = wordCount.toLocaleString();

  return (
    <div className="fixed top-[280px] left-4 z-[150] bg-[rgba(0,0,0,0.8)] backdrop-blur-sm border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-3 shadow-lg">
      <div className="text-[#666666] text-[10px] uppercase tracking-wider mb-1">Words</div>
      <div className="text-[#EEEEEE] text-xl font-light tabular-nums">{formattedCount}</div>
    </div>
  );
}
