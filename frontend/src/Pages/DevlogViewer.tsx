import React, { useState, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Download, 
  User, 
  Calendar, 
  Tag, 
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code,
  Image
} from 'lucide-react';
import canvasAPI from '../utils/canvasAPI';
import { LottieSprite } from "@qva/pixi-lottie";
import { useParams } from 'react-router-dom';

interface DevlogData {
  id: string;
  userId: string;
  username?: string;
  title: string;
  description: string;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  views?: number;
  likes?: number;
  thumbnail?: string;
  objects: any[];
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
}

interface TextStyleState {
  fontFamily?: string
  fontSize?: number
  fill?: number | string
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  align?: 'left' | 'center' | 'right'
  letterSpacing?: number
  lineHeight?: number
}


const DevlogViewer: React.FC = () => {
  const { devlogId } = useParams<{ devlogId: string }>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const isDraggingRef = useRef(false);


  const [devlog, setDevlog] = useState<DevlogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [showObjectInfo, setShowObjectInfo] = useState(false);

  useEffect(() => {
    if (devlogId) {
      loadDevlog(devlogId);
    }
  }, [devlogId]);

  const loadDevlog = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await canvasAPI.getScene(id);
      console.log('Loaded devlog data:', data);
      setDevlog(data.scene);
    } catch (err) {
      console.error('Failed to load devlog:', err);
      setError('Failed to load devlog. It may be private or not exist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!devlog || !canvasRef.current) return;

    let destroyed = false;
    const app = new PIXI.Application();

    app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      background: 0xffffff,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(async () => {
      if (destroyed || !canvasRef.current) {
        app.destroy(true);
        return;
      }

      canvasRef.current.appendChild(app.canvas);
      pixiAppRef.current = app;

      const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight - 200,
        worldWidth: 100000,
        worldHeight: 100000,
        events: app.renderer.events,
      });

      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clampZoom({
          minScale: 0.1,
          maxScale: 5,
        });

        viewport.eventMode = 'static';
viewport.on('pointerdown', () => {
  setShowObjectInfo(false);
  setSelectedObject(null);
});

viewport.plugins.remove('pinch');
viewport.plugins.remove('decelerate');

        viewport
  .on('drag-start', () => {
    isDraggingRef.current = true;
  })
  .on('drag-end', () => {
    isDraggingRef.current = false;
  });



      app.stage.addChild(viewport);
      viewportRef.current = viewport;

      await loadSceneObjects(devlog, viewport);

      viewport.moveCenter(devlog.cameraX, devlog.cameraY);
      viewport.setZoom(devlog.cameraZoom);

      const onResize = () => {
        app.renderer.resize(window.innerWidth, window.innerHeight - 200);
        viewport.resize(window.innerWidth, window.innerHeight - 200);
      };

      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
      };
    });

    return () => {
      destroyed = true;
      videoElementsRef.current.forEach(v => { v.pause(); v.src = ""; });
      videoElementsRef.current.clear();
      viewportRef.current?.destroy({ children: true });
      pixiAppRef.current?.destroy(true);
    };
  }, [devlog]);

  const downloadFile = (obj: any) => {
  const file = obj.file;
  if (!file?.url) return;

  const url = file.url.startsWith('http')
    ? file.url
    : `${import.meta.env.VITE_AWS_DEVLOGS_CANVAS_CLOUDFRONT}/${file.url}`;

  const a = document.createElement('a');
  a.href = url;
  a.download = file.name ?? 'download';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};


  const loadSceneObjects = async (scene: DevlogData, viewport: Viewport) => {
    for (const obj of scene.objects) {
      try {
        const container = new PIXI.Container();
        container.interactiveChildren = false;
        container.sortableChildren = false;
        container.zIndex = 0;
        Object.freeze(obj);
        container.position.set(obj.x, obj.y);
        container.scale.set(obj.scaleX || 1, obj.scaleY || 1);
        container.rotation = obj.rotation || 0;

        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.on('pointerdown', (e) => {
            if (isDraggingRef.current) return;
            e.stopPropagation();
            setSelectedObject(obj);
            setShowObjectInfo(true);
          });



        switch (obj.type) {
          case 'image':
            if (obj.source) {
              console.log('Loading image source:', obj.source);
             const texture = await PIXI.Assets.load(obj.source);
              const sprite = new PIXI.Sprite(texture);
              sprite.anchor.set(0.5);
              sprite.position.set(0, 0);
              container.addChild(sprite);
            }
            break;

          case 'video':
            if (obj.source) {
              console.log('Loading video source:', obj.source);
              const video = document.createElement('video');
              video.src = obj.source;
              video.crossOrigin = 'anonymous';
              video.loop = true;
              video.muted = true;
              video.playsInline = true;
              video.autoplay = true;
              videoElementsRef.current.set(obj.id, video);
              
              await new Promise<void>((resolve) => {
                video.oncanplay = () => resolve();
                video.load();
              });
             try {
  await video.play();
} catch {
  // autoplay blocked — ignore safely
}

              
              const texture = PIXI.Texture.from(video);
              const sprite = new PIXI.Sprite(texture);
              sprite.anchor.set(0.5);
              sprite.position.set(0, 0);
              container.addChild(sprite);
            }
            break;

          case 'text':
            if (obj.text) {
              const textObj = new PIXI.Text(obj.text, new PIXI.TextStyle({
                fontFamily: obj.textStyle?.fontFamily ?? 'Arial',
                fontSize: obj.textStyle?.fontSize ?? 24,
                fill: obj.textStyle?.fill ?? '#ffffff',
                fontWeight: obj.textStyle?.fontWeight ?? 'normal',
                fontStyle: obj.textStyle?.fontStyle ?? 'normal',
                align: obj.textStyle?.align ?? 'left',
              }));
              textObj.anchor.set(0.5);
              textObj.position.set(0, 0);
              container.addChild(textObj);
            }
            break;

          case 'spritesheet':
            
            if (obj.spritesheet?.jsonUrl && obj.spritesheet?.imageUrl) {
              const json = await (await fetch(obj.spritesheet.jsonUrl)).json();
              const img = new window.Image();
              img.crossOrigin = 'anonymous';
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = obj.spritesheet.imageUrl;
              });

              const baseTexture = PIXI.Texture.from(img);
              json.meta = json.meta || {};
              json.meta.image = obj.spritesheet.imageUrl;

              if (!json.frames) {
                console.warn('Invalid spritesheet JSON', obj.id);
                return;
              }
              const sheet = new PIXI.Spritesheet(baseTexture, json);
              await sheet.parse();

              let frames: PIXI.Texture[] = [];
              if (sheet.animations && Object.keys(sheet.animations).length > 0) {
                frames = sheet.animations[Object.keys(sheet.animations)[0]];
              } else {
                frames = Object.values(sheet.textures);
              }

              if (frames.length) {
                const anim = new PIXI.AnimatedSprite(frames);
                anim.anchor.set(0.5);
                anim.position.set(0, 0);
                anim.animationSpeed = 0.1;
                anim.loop = true;
                anim.play();
                container.addChild(anim);
              }
            }
            break;

          case 'lottie':
            if (obj.lottie?.jsonUrl) {
              const buffer = await (await fetch(obj.lottie.jsonUrl)).arrayBuffer();
              const lottie = new LottieSprite({
  asset: new Uint8Array(buffer),
  autoplay: true,
  loop: true,
  width: 200,
  height: 200,
  speed: 1
});

lottie.anchor.set(0.5);
lottie.position.set(0, 0);
container.addChild(lottie);

container.on('destroyed', () => {
  lottie.destroy();
});

            }
            break;

         case 'file': {
  const WIDTH = 200;
  const HEIGHT = 80;

  // Card background
  const bg = new PIXI.Graphics();
  bg.beginFill(0x1f2937); // gray-800
  bg.drawRoundedRect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, 12);
  bg.endFill();
  container.addChild(bg);

  // File icon
  const icon = new PIXI.Graphics();
  icon.beginFill(0x6366f1); // indigo
  icon.drawRoundedRect(-WIDTH / 2 + 12, -18, 36, 36, 6);
  icon.endFill();
  container.addChild(icon);

  console.log("Object",obj)

  // File extension
  const ext =
    obj.filename?.split('.').pop()?.toUpperCase() ?? 'FILE';

  const extText = new PIXI.Text(ext.slice(0, 4), {
    fontFamily: 'Arial',
    fontSize: 10,
    fill: 0xffffff,
    fontWeight: 'bold',
    align: 'center'
  });
  extText.anchor.set(0.5);
  extText.position.set(-WIDTH / 2 + 30, 0);
  container.addChild(extText);

  // Filename
  const filename = obj.file?.name ?? 'Untitled file';

  const nameText = new PIXI.Text(filename, {
    fontFamily: 'Arial',
    fontSize: 12,
    fill: 0xe5e7eb, // gray-200
    wordWrap: true,
    wordWrapWidth: WIDTH - 80
  });
  nameText.anchor.set(0, 0.5);
  nameText.position.set(-WIDTH / 2 + 60, 0);
  container.addChild(nameText);

  // Download button
  const downloadBtn = new PIXI.Graphics();
  downloadBtn.beginFill(0x10b981); // emerald
  downloadBtn.drawRoundedRect(
    WIDTH / 2 - 44,
    -16,
    32,
    32,
    8
  );
  downloadBtn.endFill();
  downloadBtn.eventMode = 'static';
  downloadBtn.cursor = 'pointer';

  downloadBtn.on('pointerdown', (e) => {
    e.stopPropagation();
    downloadFile(obj);
  });

  container.addChild(downloadBtn);

  // Download arrow
  const arrow = new PIXI.Text('↓', {
    fontSize: 18,
    fill: 0xffffff
  });
  arrow.anchor.set(0.5);
  arrow.position.set(WIDTH / 2 - 28, 0);
  container.addChild(arrow);

  break;
}

        }

        viewport.addChild(container);
      } catch (err) {
        console.error(`Failed to load object ${obj.id}:`, err);
      }
    }
  };

  const handleLike = async () => {
    if (!devlogId) return;
    setLiked(!liked);
    setDevlog(prev => prev ? {
      ...prev,
      likes: (prev.likes || 0) + (liked ? -1 : 1)
    } : null);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const zoomIn = () => {
    viewportRef.current?.zoomPercent(20, true);
  };

  const zoomOut = () => {
    viewportRef.current?.zoomPercent(-20, true);
  };

  const resetView = () => {
    if (devlog && viewportRef.current) {
      viewportRef.current.moveCenter(devlog.cameraX, devlog.cameraY);
      viewportRef.current.setZoom(devlog.cameraZoom);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading devlog...</p>
        </div>
      </div>
    );
  }

  if (error || !devlog) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-400 text-xl mb-4">{error || 'Devlog not found'}</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className=" text-white flex flex-col">
        <div
          ref={canvasRef}
          className="w-full h-full"
          style={{
            touchAction: 'none',
            overscrollBehavior: 'none'
          }}
        />

        <div className="absolute top-4 right-4 flex flex-col gap-2 bg-gray-800 p-2 rounded-lg shadow-lg">
          <button
            onClick={zoomIn}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition"
            title="Zoom In"
          >
            <ZoomIn size={20} />
          </button>

          <button
            onClick={zoomOut}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition"
            title="Zoom Out"
          >
            <ZoomOut size={20} />
          </button>

          <button
            onClick={resetView}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition"
            title="Reset View"
          >
            <Maximize2 size={20} />
          </button>
        </div>

        <div className="absolute bottom-4 left-4 bg-gray-800 px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">Objects:</span>
           <span className="font-semibold">{devlog.objects?.length ?? 0}</span>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 bg-gray-800 px-4 py-2 rounded-lg shadow-lg text-xs text-gray-400 max-w-xs">
          <div className="font-semibold mb-1">Explore:</div>
          <div>• Drag to pan • Scroll to zoom • Click objects for info</div>
        </div>

    </div>
  );
};

export default DevlogViewer;