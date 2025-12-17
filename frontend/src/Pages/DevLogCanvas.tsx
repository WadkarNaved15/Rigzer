
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { Image, Video, Type, File, Save, FolderOpen, ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react';
import { convertGifToMp4 } from '../utils/convertGifToMp4';

// Types
interface CanvasObject {
  id: string;
  type: 'image' | 'video' | 'text' | 'file' | 'code';
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  source?: string;
  text?: string;
  textStyle?: TextStyleState; 
  filename?: string;
  code?: string;
}

interface SceneState {
  objects: CanvasObject[];
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
}

interface CodeObjectRuntime {
  container: PIXI.Container
  cleanup?: () => void
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


// Constants
const SELECTION_COLOR = 0x3b82f6; // Blue
const HANDLE_COLOR = 0xffffff;

// Infinite Canvas Component
const InfiniteCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const objectsMapRef = useRef<Map<string, PIXI.Container>>(new Map());
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const codeRuntimeRef = useRef<Map<string, CodeObjectRuntime>>(new Map())


  // Selection Refs & State
  const selectionLayerRef = useRef<PIXI.Container | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  

  
  const [sceneState, setSceneState] = useState<SceneState>({
    objects: [],
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1
  });
  const selectedText = React.useMemo(
  () => sceneState.objects.find(o => o.id === selectedId && o.type === 'text'),
  [sceneState.objects, selectedId]
)

  
  const [editingText, setEditingText] = useState<{
    id: string;
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [showCodeEditor, setShowCodeEditor] = useState(false)
const [codeDraft, setCodeDraft] = useState<string>('')

// track which code object is being edited
const [editingCodeId, setEditingCodeId] = useState<string | null>(null)

type RectArgs = {
  x: number
  y: number
  w: number
  h: number
  color?: number
}

type TextArgs = {
  x: number
  y: number
  text: string
  size?: number
  color?: number
}

type ImageArgs = {
  x: number
  y: number
  url: string
  width?: number
}



const createDesignAPI = (viewport: Viewport, root: PIXI.Container) => {
  return {
    rect({ x, y, w, h, color = 0x000000 }: RectArgs) {
      const g = new PIXI.Graphics()
      g.beginFill(color).drawRect(0, 0, w, h).endFill()
      g.position.set(x, y)
      root.addChild(g)
      return g
    },

    text({ x, y, text, size = 24, color = 0x000000 }: TextArgs) {
      const t = new PIXI.Text(text, { fontSize: size, fill: color })
      t.position.set(x, y)
      root.addChild(t)
      return t
    },

    image: async ({ x, y, url, width = 200 }: ImageArgs) => {
      const tex = await PIXI.Assets.load(url)
      const s = new PIXI.Sprite(tex)
      s.width = width
      s.scale.y = s.scale.x
      s.position.set(x, y)
      root.addChild(s)
      return s
    },

    animate(fn: (delta: number) => void) {
  const ticker = pixiAppRef.current?.ticker
  if (!ticker) return () => {}

  const cb = (t: PIXI.Ticker) => fn(t.deltaTime)

  ticker.add(cb)
  return () => ticker.remove(cb)
}

  }
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



const applyCode = () => {
  if (!codeDraft.trim()) return

  // Editing existing code object
  if (editingCodeId) {
    const runtime = codeRuntimeRef.current.get(editingCodeId)
    runtime?.cleanup?.()

    const container = runtime?.container
    if (!container || !viewportRef.current) return

    container.removeChildren()

    const api = createDesignAPI(viewportRef.current, container)

    let cleanupFn: (() => void) | undefined
    runCode(codeDraft, api, fn => (cleanupFn = fn))

    codeRuntimeRef.current.set(editingCodeId, {
      container,
      cleanup: cleanupFn
    })

    setSceneState(prev => ({
      ...prev,
      objects: prev.objects.map(o =>
        o.id === editingCodeId ? { ...o, code: codeDraft } : o
      )
    }))
  }
  // Creating new code object
  else {
    addCodeObject(codeDraft)
  }

  setShowCodeEditor(false)
  setEditingCodeId(null)
}



const runCode = (
  code: string,
  api: any,
  onCleanup: (fn?: () => void) => void
) => {
  try {
    const fn = new Function(
      'design',
      `"use strict";\n${code}`
    )

    const cleanup = fn(api)
    onCleanup(cleanup)
  } catch (e) {
    console.error('Code error:', e)
  }
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

    // Get bounds of the target content
    const content = target.children[0] as PIXI.Container;
    const bounds = content.getLocalBounds();
    
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
        if(dragging) {
          dragging = false;
          viewportRef.current!.pause = false;
          updateSelectionGizmo();
        }
      };

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
      if (codeRuntimeRef.current.has(selectedId)) {
        codeRuntimeRef.current.get(selectedId)?.cleanup?.()
        codeRuntimeRef.current.delete(selectedId)
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

    container.on('pointertap', () => {
  if (container === objectsMapRef.current.get(id)) {
    const obj = sceneState.objects.find(o => o.id === id)
    if (obj?.type === 'code' && obj.code) {
      setEditingCodeId(id)
      setCodeDraft(obj.code)
      setShowCodeEditor(true)
    }
  }
})


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


  const addFile = useCallback((filename: string) => {
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
    
    const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
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
    
    const displayName = filename.length > 20 ? filename.substring(0, 17) + '...' : filename;
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
        filename
      }]
    }));
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

  const addCodeObject = useCallback((code: string) => {
  if (!viewportRef.current) return

  const id = generateId()
  const viewport = viewportRef.current

  const container = new PIXI.Container()
  viewport.addChild(container)

  setupCommonInteractions(container, id)

  const api = createDesignAPI(viewport, container)

  let cleanupFn: (() => void) | undefined

  runCode(code, api, (cleanup) => {
    cleanupFn = cleanup
  })

  codeRuntimeRef.current.set(id, {
    container,
    cleanup: cleanupFn
  })

  objectsMapRef.current.set(id, container)

  setSceneState(prev => ({
    ...prev,
    objects: [...prev.objects, {
      id,
      type: 'code',
      x: container.x,
      y: container.y,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      code
    }]
  }))

  setSelectedId(id)
}, [setupCommonInteractions])


  const handleFileUpload = useCallback(async(e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ✅ GIF → convert → VIDEO
   if (file.type === 'image/gif') {
  try {
    const mp4Blob = await convertGifToMp4(file)
    const url = URL.createObjectURL(mp4Blob)
    addVideo(url)
  } catch (error) {
    console.error('Failed to convert GIF to MP4:', error)
  }
  return
}

    
    const url = URL.createObjectURL(file);
    
    if (type === 'image') {
      addImage(url);
    } else if (type === 'video') {
      addVideo(url);
    } else {
      addFile(file.name);
    }
    
    e.target.value = '';
  }, [addImage, addVideo, addFile]);

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
        ? { ...o, textStyle: { ...o.textStyle, ...style } }
        : o
    )
  }))
}

console.log("selected Text",selectedText)

  const saveScene = useCallback(() => {
    const json = JSON.stringify(sceneState, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas_scene_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sceneState]);

  const loadScene = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const loaded: SceneState = JSON.parse(ev.target?.result as string);
        
        objectsMapRef.current.forEach(obj => obj.destroy({ children: true }));
        objectsMapRef.current.clear();
        videoElementsRef.current.forEach(video => {
          video.pause();
          video.src = '';
        });
        videoElementsRef.current.clear();
        
        loaded.objects.forEach(obj => {
          if (obj.type === 'image' && obj.source) {
            addImage(obj.source);
          } else if (obj.type === 'video' && obj.source) {
            addVideo(obj.source);
          } else if (obj.type === 'text' && obj.text) {
            addText(obj.text);
          } else if (obj.type === 'file' && obj.filename) {
            addFile(obj.filename);
          } else if (obj.type === 'code' && obj.code) {
            addCodeObject(obj.code)
        }

        });
        
        if (viewportRef.current) {
          viewportRef.current.moveCenter(loaded.cameraX, loaded.cameraY);
          viewportRef.current.setZoom(loaded.cameraZoom);
        }
      } catch (err) {
        console.error('Failed to load scene:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [addImage, addVideo, addText, addFile]);

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

      {showCodeEditor && (
  <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center">
    <div className="bg-gray-900 w-[700px] h-[500px] rounded-lg shadow-xl flex flex-col">
      
      <div className="px-4 py-2 border-b border-gray-700 text-white font-semibold">
        Code Editor
      </div>

      <textarea
        value={codeDraft}
        onChange={e => setCodeDraft(e.target.value)}
        className="flex-1 bg-black text-green-400 font-mono p-4 resize-none outline-none"
        spellCheck={false}
      />

      <div className="flex justify-end gap-2 p-3 border-t border-gray-700">
        <button
          onClick={() => setShowCodeEditor(false)}
          className="px-4 py-2 bg-gray-700 rounded"
        >
          Cancel
        </button>
        <button
          onClick={applyCode}
          className="px-4 py-2 bg-indigo-600 rounded"
        >
          Run Code
        </button>
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
        <label className="cursor-pointer p-2 bg-blue-600 hover:bg-blue-700 rounded transition" title="Add Image">
          <Image size={20} className="text-white" />
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

        <button
  onClick={() => {
    setEditingCodeId(null)
    setCodeDraft(`
// Example:
const box = design.rect({
  x: 0,
  y: 0,
  w: 200,
  h: 200,
  color: 0xff0000
})

let r = 0
const stop = design.animate((d) => {
  r += 0.01 * d
  box.rotation = r
})

return () => stop()
`)
    setShowCodeEditor(true)
  }}
  className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded transition"
  title="Add Code"
>
  {"</>"} {/* or a Code icon */}
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
        
        <label className="cursor-pointer p-2 bg-gray-600 hover:bg-gray-700 rounded transition" title="Load Scene">
          <FolderOpen size={20} className="text-white" />
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={loadScene}
          />
        </label>
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