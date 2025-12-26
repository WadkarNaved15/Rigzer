
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {  Image as ImageIcon, Video, Type, File, Save, ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react';
import JSZip from 'jszip'
import canvasAPI from '../utils/canvasAPI';
import { useUser } from '../context/user';
import type {
  CanvasObject,
  SceneState,
  TextStyleState} from '../types/canvas';


// Constants
const SELECTION_COLOR = 0x3b82f6; // Blue
const HANDLE_COLOR = 0xffffff;
const CLOUD_FRONT = import.meta.env.VITE_AWS_DEVLOGS_CANVAS_CLOUDFRONT

// Infinite Canvas Component
const InfiniteCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const objectsMapRef = useRef<Map<string, PIXI.Container>>(new Map());
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const { user } = useUser()
  const [isPublishing, setIsPublishing] = useState(false)
  const [sceneId, setSceneId] = useState<string | null>(null)



// 1. Add a new state for the UI 'mode'
type ViewMode = 'editor' | 'publishing';
const [viewMode, setViewMode] = useState<ViewMode>('editor');



  // Selection Refs & State
  const selectionLayerRef = useRef<PIXI.Container | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  

  
  const [sceneState, setSceneState] = useState<SceneState>({
    objects: [],
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1
  });
 const selectedText = React.useMemo<CanvasObject | null>(() => {
  const obj = sceneState.objects.find(
    o => o.id === selectedId && o.type === 'text'
  )
  return obj ?? null
}, [sceneState.objects, selectedId])


  
  const [editingText, setEditingText] = useState<{
    id: string;
    x: number;
    y: number;
    text: string;
  } | null>(null);


const [thumbnailKey, setThumbnailKey] = useState<string | null>(null)
const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)


const [uploadProgress, setUploadProgress] = useState<{
  visible: boolean
  label: string
  percent: number
}>({
  visible: false,
  label: '',
  percent: 0
})



const handleThumbnailUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file')
    return
  }

  // Preview (local only)
  setThumbnailPreview(URL.createObjectURL(file))

  // Upload to S3
  const key = await canvasAPI.uploadFile(file, 'thumbnail')
  setThumbnailKey(key)

  e.target.value = ''
}



const createPixiText = (text: string, style?: TextStyleState) => {
  return new PIXI.Text(text, new PIXI.TextStyle({
    fontFamily: style?.fontFamily ?? 'Arial',
    fontSize: style?.fontSize ?? 24,
    fill: style?.fill ?? 0x000000,
    fontWeight: style?.fontWeight ?? 'normal',
    fontStyle: style?.fontStyle ?? 'normal',
    align: style?.align ?? 'left',
    letterSpacing: style?.letterSpacing ?? 0,
    lineHeight: style?.lineHeight
  }))
}


 const updateObjectState = useCallback((id: string) => {
    const obj = objectsMapRef.current.get(id);
    if (!obj) return;
    
    setSceneState(prev => ({
      ...prev,
      objects: prev.objects.map(o => 
        o.id === id ? {
          ...o,
          x: obj.x,
          y: obj.y,
          scaleX: obj.scale.x,
          scaleY: obj.scale.y,
          rotation: obj.rotation
        } : o
      )
    }));
  }, []);



  const updateSelectionGizmo = useCallback(() => {
    if (!selectionLayerRef.current || !objectsMapRef.current) return;
    
    // Clear previous selection UI
    selectionLayerRef.current.removeChildren();
    
    if (!selectedId) return;
    
    const target = objectsMapRef.current.get(selectedId);
    if (!target) return;

    const bounds = target.getLocalBounds()

    // Create a container for the gizmo that matches target transforms
    const gizmo = new PIXI.Container();
    gizmo.position.copyFrom(target.position);
    gizmo.rotation = target.rotation;
    gizmo.scale.copyFrom(target.scale);
    
    // Draw Border
    const border = new PIXI.Graphics();
    border.lineStyle(2 / target.scale.x, SELECTION_COLOR);
    border.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
    gizmo.addChild(border);

    // Helper to create interactive handles
    const createHandle = (x: number, y: number, cursor: string, type: 'resize' | 'rotate') => {
      const handle = new PIXI.Graphics();
      const size = 12 / target.scale.x;
      
      handle.eventMode = 'static';
      handle.cursor = cursor;
      
      handle.beginFill(type === 'resize' ? HANDLE_COLOR : SELECTION_COLOR);
      handle.lineStyle(1 / target.scale.x, SELECTION_COLOR);
      
      if (type === 'rotate') {
        handle.circle(0, 0, size);
        const stick = new PIXI.Graphics();
        stick.lineStyle(1 / target.scale.x, SELECTION_COLOR);
        stick.moveTo(0, 0);
        stick.lineTo(0, (bounds.y - 30) - bounds.y); 
        handle.addChild(stick);
      } else {
        handle.drawRect(-size/2, -size/2, size, size);
      }
      
      handle.endFill();
      handle.position.set(x, y);

      let startMouse = { x: 0, y: 0 };
      let startState = { scale: { x: 0, y: 0 }, rotation: 0 };
      let dragging = false;

      handle.on('pointerdown', (e) => {
        e.stopPropagation();
        dragging = true;

        const viewport = viewportRef.current;
        if (!viewport) return;

        viewport.pause = true;

        const pos = e.data.getLocalPosition(viewport);
        startMouse = { x: pos.x, y: pos.y };

        startState = {
          scale: { x: target.scale.x, y: target.scale.y },
          rotation: target.rotation,
        };
      });

      const onMove = (e: any) => {
        if (!dragging) return;
        const pos = e.data.getLocalPosition(selectionLayerRef.current!.parent);
        
        if (type === 'resize') {
          const dx = pos.x - startMouse.x;
          const directionX = x < (bounds.x + bounds.width/2) ? -1 : 1;
          
          const scaleChange = dx * 0.01 * directionX; 
          const newScale = Math.max(0.1, startState.scale.x + scaleChange);
          
          target.scale.set(newScale);
          gizmo.scale.set(newScale);
        } else {
          const currentAngle = Math.atan2(pos.y - target.y, pos.x - target.x);
          const startAngle = Math.atan2(startMouse.y - target.y, startMouse.x - target.x);
          
          target.rotation = startState.rotation + (currentAngle - startAngle);
          gizmo.rotation = target.rotation;
        }
        updateObjectState(selectedId);
      };
const onUp = () => {
  if (!dragging) return

  dragging = false
const viewport = viewportRef.current
if (viewport) {
  viewport.pause = false
}

  viewportRef.current!.off('pointermove', onMove)
  viewportRef.current!.off('pointerup', onUp)
  viewportRef.current!.off('pointerupoutside', onUp)

  updateSelectionGizmo()
}


      viewportRef.current!.on('pointermove', onMove);
      viewportRef.current!.on('pointerup', onUp);
      viewportRef.current!.on('pointerupoutside', onUp);

      return handle;
    };

    // Add 4 Corner Handles (Resize)
    gizmo.addChild(createHandle(bounds.x, bounds.y, 'nw-resize', 'resize'));
    gizmo.addChild(createHandle(bounds.x + bounds.width, bounds.y, 'ne-resize', 'resize'));
    gizmo.addChild(createHandle(bounds.x, bounds.y + bounds.height, 'sw-resize', 'resize'));
    gizmo.addChild(createHandle(bounds.x + bounds.width, bounds.y + bounds.height, 'se-resize', 'resize'));
    
    // Add Rotation Handle (Top Center)
    gizmo.addChild(createHandle(bounds.x + bounds.width / 2, bounds.y - 40, 'grab', 'rotate'));

    selectionLayerRef.current.addChild(gizmo);

  }, [selectedId,updateObjectState]);

  const deleteSelectedObject = useCallback(() => {
    if (!selectedId) return;
    
    const obj = objectsMapRef.current.get(selectedId);
    if (obj) {
      obj.destroy({ children: true });
      objectsMapRef.current.delete(selectedId);
      
      
      if (videoElementsRef.current.has(selectedId)) {
        const v = videoElementsRef.current.get(selectedId);
        v?.pause();
        videoElementsRef.current.delete(selectedId);
      }
    }

    setSceneState(prev => ({
      ...prev,
      objects: prev.objects.filter(o => o.id !== selectedId)
    }));
    
    setSelectedId(null);
    selectionLayerRef.current?.removeChildren();
  }, [selectedId]);

  const setupCommonInteractions = useCallback((container: PIXI.Container, id: string) => {
    container.eventMode = 'static';
    container.cursor = 'pointer';

    let dragging = false;
    let dragStart = { x: 0, y: 0 };



    container.on('pointerdown', (e: any) => {
      e.stopPropagation();
      setSelectedId(id);
      
      dragging = true;
      const pos = e.data.getLocalPosition(container.parent);
      dragStart = { x: pos.x - container.x, y: pos.y - container.y };
      viewportRef.current!.pause = true;
    });

    container.on('pointermove', (e: any) => {
      if (dragging) {
        const pos = e.data.getLocalPosition(container.parent);
        container.position.set(pos.x - dragStart.x, pos.y - dragStart.y);
        
        if (selectedId === id) {
          updateSelectionGizmo();
        }
      }
    });

    const onEnd = () => {
      if (dragging) {
        dragging = false;
        viewportRef.current!.pause = false;
        updateObjectState(id);
      }
    };

    container.on('pointerup', onEnd);
    container.on('pointerupoutside', onEnd);
  }, [selectedId, updateObjectState, updateSelectionGizmo]);

  useEffect(() => {
    updateSelectionGizmo();
  }, [selectedId, updateSelectionGizmo]);

  useEffect(() => {
  if (user?.id) {
    canvasAPI.setUserId(user.id)
  }
}, [user])


  useEffect(() => {
    if (!canvasRef.current) return;

    let destroyed = false;

    const app = new PIXI.Application();

    app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      background: 0xffffff,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (destroyed || !canvasRef.current) {
        app.destroy(true);
        return;
      }

      canvasRef.current.appendChild(app.canvas);
      pixiAppRef.current = app;

      const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
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

      app.stage.addChild(viewport);
      viewport.moveCenter(0, 0);
      viewportRef.current = viewport;

      const selectionLayer = new PIXI.Container();
      selectionLayer.zIndex = 9999;
      viewport.addChild(selectionLayer);
      selectionLayerRef.current = selectionLayer;
      viewport.sortableChildren = true;

      viewport.on('clicked', () => {
        setSelectedId(null);
      });

      const onResize = () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        viewport.resize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener("resize", onResize);

      const updateCameraState = () => {
        setSceneState(prev => ({
          ...prev,
          cameraX: viewport.center.x,
          cameraY: viewport.center.y,
          cameraZoom: viewport.scale.x
        }));
      };

      viewport.on('moved', updateCameraState);
      viewport.on('zoomed', updateCameraState);

      return () => {
        window.removeEventListener("resize", onResize);
      };
    });

    return () => {
      destroyed = true;
      videoElementsRef.current.forEach(v => { v.pause(); v.src = ""; });
      videoElementsRef.current.clear();
      objectsMapRef.current.forEach(o => o.destroy({ children: true }));
      objectsMapRef.current.clear();
      viewportRef.current?.destroy({ children: true });
      pixiAppRef.current?.destroy(true);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingText) {
        deleteSelectedObject();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingText, deleteSelectedObject]);


    const addSpriteSheet = async (
    jsonUrl: string,
    imageUrl: string,
    options?: {
      autoplay?: boolean
      loop?: boolean
      animationName?: string
    }
  ) => {
    if (!viewportRef.current) return

    const id = generateId()
    const viewport = viewportRef.current

      const json = await (await fetch(jsonUrl)).json()

      // 🔍 DEBUG (keep for now)
      console.log('Spritesheet JSON:', json)

      // ✅ Minimal sanity check
      if (!json || typeof json !== 'object') {
        alert('Invalid spritesheet JSON')
        return
      }


      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageUrl
      })

      // Create texture from the loaded image
      const baseTexture = PIXI.Texture.from(img)
      
      // Update JSON meta to reference the texture
      json.meta = json.meta || {}
      json.meta.image = imageUrl

      // Create spritesheet
      const sheet = new PIXI.Spritesheet(baseTexture, json)
      await sheet.parse()

        // ✅ HANDLE NO animations case
        let frames: PIXI.Texture[] = []

        if (sheet.animations && Object.keys(sheet.animations).length > 0) {
          const animName =
            options?.animationName ?? Object.keys(sheet.animations)[0]
          frames = sheet.animations[animName]
        } else {
          // 🔥 Fallback: build animation from all textures
          frames = Object.values(sheet.textures)
        }

        if (!frames.length) {
          alert('Spritesheet has no frames')
          return
        }

       const anim = new PIXI.AnimatedSprite(frames)

// center correctly
anim.anchor.set(0.5)

// ✅ control speed (VERY IMPORTANT)
anim.animationSpeed = 0.1 // try 0.08 – 0.15

anim.loop = options?.loop ?? true

anim.stop()
anim.gotoAndStop(0)


const container = new PIXI.Container()
container.addChild(anim)

container.eventMode = 'static'
container.cursor = 'pointer'

// ▶️ Play on hover
container.on('pointerover', () => {
  if (!anim.playing) {
    anim.gotoAndPlay(0)
  }
})

// ⏸ Stop on hover out
container.on('pointerout', () => {
  anim.stop()
  anim.gotoAndStop(0) // reset to first frame
})


        const worldPos = viewport.toWorld(
          viewport.screenWidth / 2,
          viewport.screenHeight / 2
        )
        container.position.set(worldPos.x, worldPos.y)

        setupCommonInteractions(container, id)

        viewport.addChild(container)
        objectsMapRef.current.set(id, container)

        setSceneState(prev => ({
          ...prev,
          objects: [
            ...prev.objects,
            {
              id,
              type: 'spritesheet',
              x: container.x,
              y: container.y,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
              spritesheet: {
                jsonUrl,
                imageUrl,
                animationName: options?.animationName,
                autoplay: options?.autoplay ?? true,
                loop: options?.loop ?? true
              }
            }
          ]
        }))

        setSelectedId(id)
      }

  const generateId = () => `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addImage = useCallback(async (url: string) => {
    if (!viewportRef.current) return;
    const id = generateId();
    const viewport = viewportRef.current;
    
    try {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      
      const texture = PIXI.Texture.from(img);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      
      const container = new PIXI.Container();
      container.addChild(sprite);
      
      const worldPos = viewport.toWorld(viewport.screenWidth / 2, viewport.screenHeight / 2);
      container.position.set(worldPos.x, worldPos.y);
      
      const maxSize = 300;
      const scale = Math.min(maxSize / sprite.width, maxSize / sprite.height);
      container.scale.set(scale);
      
      setupCommonInteractions(container, id);
      
      viewport.addChild(container);
      objectsMapRef.current.set(id, container);
      
      setSceneState(prev => ({
        ...prev,
        objects: [...prev.objects, {
          id, type: 'image',
          x: container.x, y: container.y,
          scaleX: container.scale.x, scaleY: container.scale.y,
          rotation: container.rotation, source: url
        }]
      }));
      setSelectedId(id);
      return id;
    } catch (error) {
      console.error('Failed to load image:', error);
    }
  }, [setupCommonInteractions]);

  const addVideo = useCallback(async (url: string) => {
    if (!viewportRef.current) return;
    const id = generateId();
    const viewport = viewportRef.current;
    
    try {
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true; 
      video.autoplay = true;

      videoElementsRef.current.set(id, video);
      
      await new Promise<void>((resolve, reject) => {
        video.oncanplay = () => resolve();
        video.onerror = reject;
        video.load();
      });
      await video.play();
      
      const texture = PIXI.Texture.from(video);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      
      const container = new PIXI.Container();
      container.addChild(sprite);
      
      const worldPos = viewport.toWorld(viewport.screenWidth / 2, viewport.screenHeight / 2);
      container.position.set(worldPos.x, worldPos.y);
      
      const maxSize = 400;
      const scale = Math.min(maxSize / video.videoWidth, maxSize / video.videoHeight);
      container.scale.set(scale);
      
      setupCommonInteractions(container, id);
      
      viewport.addChild(container);
      objectsMapRef.current.set(id, container);
      
      setSceneState(prev => ({
        ...prev,
        objects: [...prev.objects, {
          id, type: 'video',
          x: container.x, y: container.y,
          scaleX: container.scale.x, scaleY: container.scale.y,
          rotation: container.rotation, source: url
        }]
      }));
      setSelectedId(id);
    } catch (error) {
      console.error('Failed to load video:', error);
    }
  }, [setupCommonInteractions]);

const addText = useCallback(
  (initialText: string = 'Double-click to edit') => {
    if (!viewportRef.current) return

    const id = generateId()
    const viewport = viewportRef.current

    // ✅ Default style
    const defaultStyle: TextStyleState = {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0x000000,
      fontWeight: 'normal',
      fontStyle: 'normal',
      align: 'left',
      letterSpacing: 0
    }

    // ✅ Create container FIRST
    const container = new PIXI.Container()

    // ✅ Create text using helper
    const textObj = createPixiText(initialText, defaultStyle)
    textObj.anchor.set(0.5)

    container.addChild(textObj)

    // Center in viewport
    const worldPos = viewport.toWorld(
      viewport.screenWidth / 2,
      viewport.screenHeight / 2
    )
    container.position.set(worldPos.x, worldPos.y)

    container.eventMode = 'static'
    container.cursor = 'pointer'

    let dragging = false
    let hasMoved = false
    let dragStart = { x: 0, y: 0 }
    let lastClickTime = 0

    container.on('pointerdown', (e: any) => {
      e.stopPropagation()
      setSelectedId(id)

      hasMoved = false
      const pos = e.data.getLocalPosition(container.parent)
      dragStart = { x: pos.x - container.x, y: pos.y - container.y }
      dragging = true
      viewport.pause = true
    })

    container.on('pointermove', (e: any) => {
      if (!dragging) return

      const pos = e.data.getLocalPosition(container.parent)
      const newX = pos.x - dragStart.x
      const newY = pos.y - dragStart.y

      if (Math.abs(newX - container.x) > 5 || Math.abs(newY - container.y) > 5) {
        hasMoved = true
        container.position.set(newX, newY)
        if (selectedId === id) updateSelectionGizmo()
      }
    })

    const onEnd = () => {
      if (!dragging) return

      dragging = false
      viewport.pause = false

      if (!hasMoved) {
        const now = Date.now()
        if (now - lastClickTime < 400) {
          const screenPos = viewport.toScreen(container.x, container.y)
          setEditingText({
            id,
            x: screenPos.x,
            y: screenPos.y,
            text: textObj.text
          })
        }
        lastClickTime = now
      } else {
        updateObjectState(id)
      }
    }

    container.on('pointerup', onEnd)
    container.on('pointerupoutside', onEnd)

    viewport.addChild(container)
    objectsMapRef.current.set(id, container)

    // ✅ SAVE STYLE INTO STATE
    setSceneState(prev => ({
      ...prev,
      objects: [
        ...prev.objects,
        {
          id,
          type: 'text',
          x: container.x,
          y: container.y,
          scaleX: container.scale.x,
          scaleY: container.scale.y,
          rotation: container.rotation,
          text: initialText,
          textStyle: defaultStyle
        }
      ]
    }))

    setSelectedId(id)
  },
  [selectedId, updateObjectState, updateSelectionGizmo]
)


  const addFile = useCallback((file: {
  name: string
  url: string
  size?: number
  mimeType?: string
}) => {
    if (!viewportRef.current) return;

    const id = generateId();
    const viewport = viewportRef.current;
    
    const container = new PIXI.Container();
    
    const shadow = new PIXI.Graphics();
    shadow.fill(0x000000, 0.2);
    shadow.roundRect(4, 4, 160, 180, 10);
    shadow.fill();
    
    const bg = new PIXI.Graphics();
    bg.beginFill(0x2d2d2d);
    bg.lineStyle(2, 0x404040);
    bg.drawRoundedRect(0, 0, 160, 180, 10);
    bg.endFill();
    
    const fileIcon = new PIXI.Graphics();
    fileIcon.beginFill(0x4a9eff);
    fileIcon.drawRoundedRect(35, 20, 90, 100, 5);
    fileIcon.endFill();
    
    fileIcon.beginFill(0x3a7ecf);
    fileIcon.moveTo(125, 20);
    fileIcon.lineTo(105, 20);
    fileIcon.lineTo(125, 40);
    fileIcon.lineTo(125, 20);
    fileIcon.endFill();
    
    const lines = new PIXI.Graphics();
    lines.lineStyle(2, 0xffffff, 0.3);
    for (let i = 0; i < 5; i++) {
      lines.moveTo(45, 40 + i * 12);
      lines.lineTo(115, 40 + i * 12);
    }
    
    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    const extBadge = new PIXI.Graphics();
    extBadge.beginFill(0xff6b6b);
    extBadge.drawRoundedRect(50, 125, 60, 25, 5);
    extBadge.endFill();
    
    const extText = new PIXI.Text(ext.substring(0, 4), {
      fontFamily: 'Arial',
      fontSize: 12,
      fill: 0xffffff,
      fontWeight: 'bold',
      align: 'center'
    });
    extText.anchor.set(0.5);
    extText.position.set(80, 137.5);
    
    const displayName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
    const nameText = new PIXI.Text(displayName, {
      fontFamily: 'Arial',
      fontSize: 13,
      fill: 0xffffff,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 150
    });
    nameText.anchor.set(0.5);
    nameText.position.set(80, 162);
    
    container.addChild(shadow, bg, fileIcon, lines, extBadge, extText, nameText);
    container.pivot.set(80, 90);
    
    const worldPos = viewport.toWorld(viewport.screenWidth / 2, viewport.screenHeight / 2);
    container.position.set(worldPos.x, worldPos.y);
    
    setupCommonInteractions(container, id);
    
    viewport.addChild(container);
    objectsMapRef.current.set(id, container);

    container.on('pointertap', () => {
  if (!file.url) return

  // if S3 key → backend should resolve to signed URL
  window.open(
  file.url.startsWith('http')
    ? file.url
    : `${CLOUD_FRONT}/${file.url}`,
  '_blank'
)
})

    
setSceneState(prev => ({
  ...prev,
  objects: [...prev.objects, {
    id,
    type: 'file',
    x: container.x,
    y: container.y,
    scaleX: container.scale.x,
    scaleY: container.scale.y,
    rotation: container.rotation,
    file
  }]
}))

    setSelectedId(id);
  }, [setupCommonInteractions]);

  const handleTextEdit = useCallback((newText: string) => {
    if (!editingText) return;
    
    const obj = objectsMapRef.current.get(editingText.id);
    if (obj) {
      const textObj = obj.children[0] as PIXI.Text;
      textObj.text = newText;
      
      setSceneState(prev => ({
        ...prev,
        objects: prev.objects.map(o => 
          o.id === editingText.id ? { ...o, text: newText } : o
        )
      }));
    }
    
    setEditingText(null);
  }, [editingText]);



const handleFileUpload = useCallback(
  async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video' | 'file'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)

    if (type === 'image') {
      addImage(url)
    } else if (type === 'video') {
      addVideo(url)
    } else {
      addFile({
        name: file.name,
        url,
        size: file.size,
        mimeType: file.type
      })
    }

    e.target.value = ''
  },
  [addImage, addVideo, addFile]
)


  const handleSpriteUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const files = Array.from(e.target.files ?? [])
  if (!files.length) return

  // 🔹 ZIP upload
  if (files.length === 1 && files[0].name.endsWith('.zip')) {
    await handleSpriteZip(files[0])
    e.target.value = ''
    return
  }

  // 🔹 JSON + Image upload
  const jsonFile = files.find(f => f.name.endsWith('.json'))
  const imageFile = files.find(f => f.type.startsWith('image/'))

  if (!jsonFile || !imageFile) {
    alert('Sprite sheet requires JSON + image (or ZIP)')
    return
  }

  await addSpriteSheet(
    URL.createObjectURL(jsonFile),
    URL.createObjectURL(imageFile),
    { autoplay: true, loop: true }
  )

  e.target.value = ''
}


const handleSpriteZip = async (zipFile: File) => {
  const zip = await JSZip.loadAsync(zipFile)

  let jsonBlob: Blob | null = null
  let imageBlob: Blob | null = null

  await Promise.all(
    Object.values(zip.files).map(async file => {
      if (file.dir) return

      if (file.name.endsWith('.json')) {
        jsonBlob = await file.async('blob')
      }

      if (
        file.name.endsWith('.png') ||
        file.name.endsWith('.webp')
      ) {
        imageBlob = await file.async('blob')
      }
    })
  )

  if (!jsonBlob || !imageBlob) {
    alert('ZIP must contain exactly one JSON and one image')
    return
  }

  await addSpriteSheet(
    URL.createObjectURL(jsonBlob),
    URL.createObjectURL(imageBlob),
    { autoplay: true, loop: true }
  )
}


const applyTextStyle = (style: Partial<TextStyleState>) => {
  if (!selectedId) return

  const container = objectsMapRef.current.get(selectedId)
  if (!container) return

  const textObj = container.children[0]
  if (!(textObj instanceof PIXI.Text)) return

  // ✅ MUTATE STYLE DIRECTLY
  Object.entries(style).forEach(([key, value]) => {
    // @ts-expect-error – dynamic TextStyle assignment
      textObj.style[key] = value

  })


  // ✅ Persist in scene state
  setSceneState(prev => ({
    ...prev,
    objects: prev.objects.map(o =>
      o.id === selectedId
        ? { ...o, textStyle: { ...(o.textStyle ?? {}), ...style }}
        : o
    )
  }))
}

const saveScene = useCallback(async () => {
  setUploadProgress({
    visible: true,
    label: 'Uploading canvas assets...',
    percent: 0
  });

  try {
    // 1. Upload assets and scene structure
    const data = await canvasAPI.uploadCanvasOnly(
      sceneState,
      (p, stage) => setUploadProgress(v => ({
        ...v,
        percent: p,
        label: stage || v.label
      }))
    );


    if (!data || !data.sceneId) {
      throw new Error("No sceneId returned from server");
    }

    setSceneId(data.sceneId)

    // 2. Generate preview for the publishing page
    const app = pixiAppRef.current;
    const viewport = viewportRef.current;

    if (app && viewport) {
      // ✅ FIX: Pass the viewport as the target to extract
      // Pixi v8 extract.canvas requires a target (Container or Texture)
      const canvas = app.renderer.extract.canvas({
        target: viewport,
      });

      // Convert the ICanvas to a data URL for the preview
      if (canvas && typeof canvas.toDataURL === 'function') {
        setThumbnailPreview(canvas.toDataURL('image/png'));
      }
    }

    // 3. Clear progress and switch view
    setUploadProgress({ visible: false, label: '', percent: 0 });
    setViewMode('publishing');

  } catch (error) {
    console.error('Save error details:', error);
    setUploadProgress({ visible: false, label: '', percent: 0 });
    alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}, [sceneState]);


  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const newZoom = viewport.scale.x * factor;

    viewport.zoomPercent(
      ((newZoom - viewport.scale.x) / viewport.scale.x) * 100,
      true
    );
  };

  const zoomIn = () => zoomBy(1.2);
  const zoomOut = () => zoomBy(0.8);

  const resetView = () => {
    viewportRef.current?.moveCenter(0, 0);
    viewportRef.current?.setZoom(1);
  };


const handleFinalPublish = async () => {
  if (isPublishing) return
  if (!sceneId) {
    alert('No scene to publish')
    return
  }

  setIsPublishing(true)
  setUploadProgress({
    visible: true,
    label: 'Publishing canvas...',
    percent: 0
  })

  try {
    const title =
      (document.getElementById('pub-title') as HTMLInputElement)?.value ||
      'Untitled'

    const description =
      (document.getElementById('pub-desc') as HTMLTextAreaElement)?.value || ''

    const tags =
      (document.getElementById('pub-tags') as HTMLInputElement)?.value
        ?.split(',')
        .map(t => t.trim())
        .filter(Boolean) || []

    /* ---------------- Thumbnail ---------------- */

    let finalThumbKey = thumbnailKey

    if (!finalThumbKey) {
      const app = pixiAppRef.current
      const viewport = viewportRef.current

      if (!app || !viewport) {
        throw new Error('Renderer not ready')
      }

      const canvas = app.renderer.extract.canvas({ target: viewport })

   const blob = await new Promise<Blob>((resolve, reject) => {
  canvas?.toBlob?.(b => {
    if (!b) reject(new Error("Thumbnail creation failed"))
    else resolve(b)
  }, "image/png")

  if (!canvas || !canvas.toBlob) {
    reject(new Error("Canvas toBlob not supported"))
  }
})


      finalThumbKey = await canvasAPI.uploadFile(
        blob,
        'thumbnail',
        'thumbnail.png'
      )
    }

    if (!finalThumbKey) {
      throw new Error('Thumbnail upload failed')
    }

    /* ---------------- Meta + Publish ---------------- */

    setUploadProgress({
      visible: true,
      label: 'Finalizing publish...',
      percent: 95
    })

    await canvasAPI.updateSceneMeta(sceneId, {
      title,
      description,
      tags,
      isPublic: true
    })

    await canvasAPI.publishScene(sceneId, finalThumbKey)

    /* ---------------- Cleanup ---------------- */

    setUploadProgress({ visible: false, label: '', percent: 0 })
    setThumbnailKey(null)
    setThumbnailPreview(null)
    setIsPublishing(false)
    setViewMode('editor')

    alert('🎉 Published Successfully!')
  } catch (err) {
    console.error(err)
    setUploadProgress({ visible: false, label: '', percent: 0 })
    setIsPublishing(false)
    alert(err instanceof Error ? err.message : 'Publish failed')
  }
}



  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      <div
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          touchAction: 'none',
          overscrollBehavior: 'none'
        }}
      />

  {viewMode === 'publishing' && (
  <div className="fixed inset-0 z-[10000] bg-[#050505] text-white flex flex-col">

    {/* Header */}
    <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
     <button
  disabled={isPublishing}
  onClick={() => setViewMode('editor')}
  className={`${
    isPublishing ? 'opacity-50 cursor-not-allowed' : 'hover:text-white'
  } text-gray-400 transition`}
>
  ← Back to Editor
</button>


      <h1 className="text-xl font-bold">Publish Canvas</h1>
    </header>

    {/* Content */}
    <main className="flex-1 overflow-auto px-12 py-10">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* LEFT — Thumbnail */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase text-gray-400">
            Thumbnail
          </h3>

          <div className="aspect-video rounded-2xl overflow-hidden bg-gray-900 border border-white/10">
            {thumbnailPreview ? (
              <img
                src={thumbnailPreview}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600">
                No preview
              </div>
            )}
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer">
            <ImageIcon size={18} />
            Upload Custom Thumbnail
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={handleThumbnailUpload}
            />
          </label>
        </div>

        {/* RIGHT — Details */}
        <div className="space-y-6">

          <div>
            <label className="block text-sm mb-1">Title</label>
            <input
              id="pub-title"
              placeholder="Awesome Canvas"
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10"
            />
          </div>

          <div>
  <label className="block text-sm mb-1">Description</label>
  <textarea
    id="pub-desc"
    placeholder="Describe your canvas"
    className="w-full p-4 rounded-xl bg-white/5 border border-white/10 resize-none"
    rows={4}
  />
</div>


          <div>
            <label className="block text-sm mb-1">Tags</label>
            <input
              id="pub-tags"
              placeholder="art, pixi"
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10"
            />
          </div>

          <button
  onClick={handleFinalPublish}
  disabled={isPublishing}
  className={`w-full py-4 rounded-xl font-bold text-lg transition ${
    isPublishing
      ? 'bg-gray-600 cursor-not-allowed'
      : 'bg-green-600 hover:bg-green-500'
  }`}
>
  {isPublishing ? 'Publishing…' : 'Publish'}
</button>


        </div>
      </div>
    </main>
  </div>
)}

      {uploadProgress.visible && (
  <div className="absolute inset-0 bg-black/70 z-[9999] flex items-center justify-center">
    <div className="bg-gray-900 p-6 rounded-xl w-80 text-white">
      <div className="mb-2 font-semibold">
        {uploadProgress.label}
      </div>

      <div className="w-full bg-gray-700 h-2 rounded overflow-hidden">
        <div
          className="bg-indigo-500 h-full transition-all"
          style={{ width: `${uploadProgress.percent}%` }}
        />
      </div>

      <div className="text-right text-xs mt-1">
        {uploadProgress.percent}%
      </div>
    </div>
  </div>
)}



      {selectedText && (
  <div className="absolute top-20 left-4 bg-gray-800 p-3 rounded-lg shadow-lg z-50 text-white w-56">
    
    <label className="block text-xs mb-1">Font</label>
    <select
  value={selectedText.textStyle?.fontFamily ?? 'Arial'}
  onChange={e => applyTextStyle({ fontFamily: e.target.value })}
  className="w-full bg-gray-700 p-1 rounded"
>

      <option>Arial</option>
      <option>Times New Roman</option>
      <option>Courier New</option>
      <option>Georgia</option>
    </select>

    <label className="block text-xs mt-2 mb-1">Size</label>
   <input
  type="number"
  value={selectedText.textStyle?.fontSize ?? 24}
  onChange={e => applyTextStyle({ fontSize: +e.target.value })}
  className="w-full bg-gray-700 p-1 rounded"
/>


    <label className="block text-xs mt-2 mb-1">Color</label>
    <input
  type="color"
  value={
    typeof selectedText.textStyle?.fill === 'string'
      ? selectedText.textStyle.fill
      : '#000000'
  }
  onChange={e => applyTextStyle({ fill: e.target.value })}
  className="w-full"
/>


    <div className="flex gap-2 mt-2">
<button
  onClick={() =>
    applyTextStyle({
      fontWeight:
        selectedText.textStyle?.fontWeight === 'bold'
          ? 'normal'
          : 'bold'
    })
  }
  className={`flex-1 rounded p-1 ${
    selectedText.textStyle?.fontWeight === 'bold'
      ? 'bg-indigo-600'
      : 'bg-gray-700'
  }`}
>
  B
</button>

<button
  onClick={() =>
    applyTextStyle({
      fontStyle:
        selectedText.textStyle?.fontStyle === 'italic'
          ? 'normal'
          : 'italic'
    })
  }
  className={`flex-1 rounded p-1 italic ${
    selectedText.textStyle?.fontStyle === 'italic'
      ? 'bg-indigo-600'
      : 'bg-gray-700'
  }`}
>
  I
</button>

    </div>

  </div>
)}

      
      <div className="absolute top-4 left-4 flex gap-2 bg-gray-800 p-2 rounded-lg shadow-lg">
     
        <label
  className="cursor-pointer p-2 bg-pink-600 hover:bg-pink-700 rounded transition"
  title="Add Sprite Animation"
>
  🎞
  <input
    type="file"
    accept=".zip,.json,image/png,image/webp"
    multiple
    className="hidden"
    onChange={handleSpriteUpload}
  />
</label>

        <label className="cursor-pointer p-2 bg-blue-600 hover:bg-blue-700 rounded transition" title="Add Image">
          <ImageIcon size={20} className="text-white" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e, 'image')}
          />
        </label>
        
        <label className="cursor-pointer p-2 bg-purple-600 hover:bg-purple-700 rounded transition" title="Add Video">
          <Video size={20} className="text-white" />
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e, 'video')}
          />
        </label>
        
        <button
          onClick={() => addText()}
          className="p-2 bg-green-600 hover:bg-green-700 rounded transition"
          title="Add Text"
        >
          <Type size={20} className="text-white" />
        </button>

 

        
        <label className="cursor-pointer p-2 bg-yellow-600 hover:bg-yellow-700 rounded transition" title="Add File">
          <File size={20} className="text-white" />
          <input
            type="file"
            className="hidden"
            onChange={(e) => handleFileUpload(e, 'file')}
          />
        </label>
        
        <div className="w-px bg-gray-600 mx-1" />
        
        {selectedId && (
          <button onClick={deleteSelectedObject} className="p-2 bg-red-600 hover:bg-red-700 rounded transition" title="Delete Selected">
            <Trash2 size={20} className="text-white" />
          </button>
        )}
        
        <div className="w-px bg-gray-600 mx-1" />
        
        <button
          onClick={saveScene}
          className="p-2 bg-gray-600 hover:bg-gray-700 rounded transition"
          title="Save Scene"
        >
          <Save size={20} className="text-white" />
        </button>
      

      </div>
      
      {/* Camera Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-gray-800 p-2 rounded-lg shadow-lg">
      <button
  onClick={() => {
    console.log('ZOOM IN CLICKED');
    zoomIn();
  }}
  className="p-2 bg-gray-600 hover:bg-gray-700 rounded transition"
>
  <ZoomIn size={20} className="text-white" />
</button>

<button
  onClick={() => {
    console.log('ZOOM OUT CLICKED');
    zoomOut();
  }}
  className="p-2 bg-gray-600 hover:bg-gray-700 rounded transition"
>
  <ZoomOut size={20} className="text-white" />
</button>

        
        <button
          onClick={resetView}
          className="p-2 bg-gray-600 hover:bg-gray-700 rounded transition"
          title="Reset View"
        >
          <Maximize2 size={20} className="text-white" />
        </button>
      </div>
      
      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 bg-gray-800 px-4 py-2 rounded-lg shadow-lg text-white text-sm">
        Objects: {sceneState.objects.length} | 
        X: {Math.round(sceneState.cameraX)} | 
        Y: {Math.round(sceneState.cameraY)} | 
        Zoom: {(sceneState.cameraZoom * 100).toFixed(0)}%
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-gray-800 px-4 py-2 rounded-lg shadow-lg text-gray-300 text-xs max-w-xs">
        <div className="font-semibold mb-1">Controls:</div>
        <div>• Drag objects to move them</div>
        <div>• Double-click text to edit</div>
        <div>• Scroll to zoom, drag empty space to pan</div>
      </div>
      
      {/* Text Editing Overlay */}
      {editingText && (
        <div
          className="absolute z-50"
          style={{
            left: editingText.x - 150,
            top: editingText.y - 40
          }}
        >
          <textarea
            autoFocus
            defaultValue={editingText.text}
            onBlur={(e) => handleTextEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTextEdit(e.currentTarget.value);
              } else if (e.key === 'Escape') {
                setEditingText(null);
              }
            }}
            className="w-80 min-h-16 p-3 bg-white border-2 border-blue-500 rounded-lg shadow-xl text-black resize-none focus:outline-none focus:border-blue-600"
            placeholder="Enter text..."
          />
          <div className="text-xs text-gray-400 mt-1 text-center bg-gray-800 p-1 rounded">
            Press Enter to save • Shift+Enter for new line • Esc to cancel
          </div>
        </div>
      )}
    </div>
  );
};

export default InfiniteCanvas;
