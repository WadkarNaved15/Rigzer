interface AlignmentGuidesProps {
  activeX: number;
  activeY: number;
  elements: Array<{ x: number; y: number; width?: number; height?: number }>;
  snapThreshold?: number;
}

export default function AlignmentGuides({
  activeX,
  activeY,
  elements,
  snapThreshold = 5,
}: AlignmentGuidesProps) {
  if (activeX === -1 || activeY === -1) return null;

  const guides: Array<{ type: 'vertical' | 'horizontal'; position: number }> = [];
  const centerX = activeX;
  const centerY = activeY;

  elements.forEach((element) => {
    const elementCenterX = element.x + (element.width || 0) / 2;
    const elementCenterY = element.y + (element.height || 0) / 2;

    if (Math.abs(centerX - element.x) < snapThreshold) {
      guides.push({ type: 'vertical', position: element.x });
    }

    if (Math.abs(centerX - elementCenterX) < snapThreshold) {
      guides.push({ type: 'vertical', position: elementCenterX });
    }

    if (Math.abs(centerX - (element.x + (element.width || 0))) < snapThreshold) {
      guides.push({ type: 'vertical', position: element.x + (element.width || 0) });
    }

    if (Math.abs(centerY - element.y) < snapThreshold) {
      guides.push({ type: 'horizontal', position: element.y });
    }

    if (Math.abs(centerY - elementCenterY) < snapThreshold) {
      guides.push({ type: 'horizontal', position: elementCenterY });
    }

    if (Math.abs(centerY - (element.y + (element.height || 0))) < snapThreshold) {
      guides.push({ type: 'horizontal', position: element.y + (element.height || 0) });
    }
  });

  const centerGuideX = window.innerWidth / 2;
  const centerGuideY = window.innerHeight / 2;

  if (Math.abs(centerX - centerGuideX) < snapThreshold) {
    guides.push({ type: 'vertical', position: centerGuideX });
  }

  if (Math.abs(centerY - centerGuideY) < snapThreshold) {
    guides.push({ type: 'horizontal', position: centerGuideY });
  }

  const uniqueGuides = guides.filter(
    (guide, index, self) =>
      index === self.findIndex((g) => g.type === guide.type && g.position === guide.position)
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {uniqueGuides.map((guide, index) => (
        <div
          key={`${guide.type}-${guide.position}-${index}`}
          className={`absolute bg-blue-500/50 ${
            guide.type === 'vertical' ? 'w-px h-full' : 'h-px w-full'
          }`}
          style={{
            [guide.type === 'vertical' ? 'left' : 'top']: `${guide.position}px`,
          }}
        />
      ))}

      <div
        className="absolute w-px h-full bg-green-500/20"
        style={{ left: `${centerGuideX}px` }}
      />
      <div
        className="absolute h-px w-full bg-green-500/20"
        style={{ top: `${centerGuideY}px` }}
      />
    </div>
  );
}
