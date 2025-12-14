import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { Image, Video, Type, File, Save, FolderOpen, ZoomIn, ZoomOut, Maximize2,Trash2 } from 'lucide-react';

// Types
interface CanvasObject {
  id: string;
  type: 'image' | 'video' | 'text' | 'file';
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  source?: string;
  text?: string;
  filename?: string;
}

interface SceneState {
  objects: CanvasObject[];
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
}

// Infinite Canvas Component
const InfiniteCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const objectsMapRef = useRef<Map<string, PIXI.Container>>(new Map());
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Selection Refs & State
  const selectionLayerRef = useRef<PIXI.Container | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
    // Add these constants before the component definition
  const SELECTION_COLOR = 0x3b82f6; // Blue
  const HANDLE_COLOR = 0xffffff;
  
  const [sceneState, setSceneState] = useState<SceneState>({
    objects: [],
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1
  });
  
  const [editingText, setEditingText] = useState<{
    id: string;
    x: number;
    y: number;
    text: string;
  } | null>(null);


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
      const size = 12 / target.scale.x; // Keep handle size consistent visually
      
      handle.eventMode = 'static';
      handle.cursor = cursor;
      
      handle.beginFill(type === 'resize' ? HANDLE_COLOR : SELECTION_COLOR);
      handle.lineStyle(1 / target.scale.x, SELECTION_COLOR);
      
      if (type === 'rotate') {
        handle.drawCircle(0, 0, size);
        // Stick connecting to box
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

      // Interaction Logic for Handles
      let startMouse = { x: 0, y: 0 };
      let startState = { scale: { x: 0, y: 0 }, rotation: 0 };
      let dragging = false;

     handle.on('pointerdown', (e) => {
  e.stopPropagation();
  dragging = true;

  const viewport = viewportRef.current;
  if (!viewport) return;

  viewport.pause = true; // Disable viewport drag

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
            // Determine direction based on handle position relative to center
            const directionX = x < (bounds.x + bounds.width/2) ? -1 : 1;
            
            // Simple uniform scaling calculation
            const scaleChange = dx * 0.01 * directionX; 
            const newScale = Math.max(0.1, startState.scale.x + scaleChange);
            
            target.scale.set(newScale);
            gizmo.scale.set(newScale);
        } else {
            // Rotation
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
            updateSelectionGizmo(); // Refresh line widths
        }
      };

      // Listen on viewport to catch moves even if mouse goes off handle
      viewportRef.current!.on('pointermove', onMove);
      viewportRef.current!.on('pointerup', onUp);
      viewportRef.current!.on('pointerupoutside', onUp);

      return handle;
    };

    // Add 4 Corner Handles (Resize)
    gizmo.addChild(createHandle(bounds.x, bounds.y, 'nw-resize', 'resize')); // TL
    gizmo.addChild(createHandle(bounds.x + bounds.width, bounds.y, 'ne-resize', 'resize')); // TR
    gizmo.addChild(createHandle(bounds.x, bounds.y + bounds.height, 'sw-resize', 'resize')); // BL
    gizmo.addChild(createHandle(bounds.x + bounds.width, bounds.y + bounds.height, 'se-resize', 'resize')); // BR
    
    // Add Rotation Handle (Top Center)
    gizmo.addChild(createHandle(bounds.x + bounds.width / 2, bounds.y - 40, 'grab', 'rotate'));

    selectionLayerRef.current.addChild(gizmo);

  }, [selectedId]); // Will be defined below


  // --- 2. Deletion Logic ---
  const deleteSelectedObject = useCallback(() => {
    if (!selectedId) return;
    
    const obj = objectsMapRef.current.get(selectedId);
    if (obj) {
      obj.destroy({ children: true });
      objectsMapRef.current.delete(selectedId);
      
      // Cleanup video reference if it exists
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


  // --- 3. Object Update & Interaction Logic ---
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

  // Generic interaction setup (Drag, Select)
  const setupCommonInteractions = useCallback((container: PIXI.Container, id: string) => {
    container.eventMode = 'static';
    container.cursor = 'pointer';

    let dragging = false;
    let dragStart = { x: 0, y: 0 };

    container.on('pointerdown', (e: any) => {
        e.stopPropagation();
        setSelectedId(id); // Select object on click
        
        dragging = true;
        const pos = e.data.getLocalPosition(container.parent);
        dragStart = { x: pos.x - container.x, y: pos.y - container.y };
        viewportRef.current!.pause = true;
    });

    container.on('pointermove', (e: any) => {
        if (dragging) {
            const pos = e.data.getLocalPosition(container.parent);
            container.position.set(pos.x - dragStart.x, pos.y - dragStart.y);
            
            // If dragging the selected object, update the gizmo in real-time
            if (id === selectedId) updateSelectionGizmo(); 
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

  // Update Gizmo whenever selection changes
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
      background: 0x1a1a1a,
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

      // ADD THIS: Create Selection Layer on top of everything
   // Create Selection Layer (Z-Index 9999 ensures it's always on top)
      const selectionLayer = new PIXI.Container();
      selectionLayer.zIndex = 9999;
      viewport.addChild(selectionLayer);
      selectionLayerRef.current = selectionLayer;
      viewport.sortableChildren = true;

      // Click background to deselect
      viewport.on('clicked', () => {
        setSelectedId(null);
      });
      const onResize = () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        viewport.resize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener("resize", onResize);

      // Camera state tracking
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

  // Keyboard Delete Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingText) {
        deleteSelectedObject();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingText, deleteSelectedObject]);

  // Create a unique ID
  const generateId = () => `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;



// Add image to canvas
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
      
      // Use common interaction logic
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
      setSelectedId(id); // Auto-select
    } catch (error) {
      console.error('Failed to load image:', error);
    }
  }, [setupCommonInteractions, updateObjectState]);

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
  }, [setupCommonInteractions, updateObjectState]);

  // Add text to canvas
const addText = useCallback((initialText: string = 'Double-click to edit') => {
    if (!viewportRef.current) return;
    const id = generateId();
    const viewport = viewportRef.current;
    
    const text = new PIXI.Text(initialText, {
      fontFamily: 'Arial', fontSize: 24, fill: 0xffffff,
      wordWrap: true, wordWrapWidth: 300
    });
    text.anchor.set(0.5);
    
    const container = new PIXI.Container();
    container.addChild(text);
    
    const worldPos = viewport.toWorld(viewport.screenWidth / 2, viewport.screenHeight / 2);
    container.position.set(worldPos.x, worldPos.y);
    
    // Make interactive
    container.eventMode = 'static';
    container.cursor = 'pointer';
    
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let lastClickTime = 0; // For double-click detection
    
    container.on('pointerdown', (e: any) => {
      e.stopPropagation();
      
      // 1. Single Click: Select the object immediately
      setSelectedId(id);
      
      dragging = true;
      const pos = e.data.getLocalPosition(container.parent);
      dragStart = { x: pos.x - container.x, y: pos.y - container.y };
      viewport.pause = true;

      // 2. Double Click Detection logic
      const now = Date.now();
      if (now - lastClickTime < 300) {
        // It's a double click! Enter edit mode
        const screenPos = viewport.toScreen(container.x, container.y);
        setEditingText({
          id, 
          x: screenPos.x, 
          y: screenPos.y,
          text: (container.children[0] as PIXI.Text).text
        });
        dragging = false; // Stop dragging if we are editing
      }
      lastClickTime = now;
    });
    
    container.on('pointermove', (e: any) => {
      if (dragging) {
        const pos = e.data.getLocalPosition(container.parent);
        container.position.set(pos.x - dragStart.x, pos.y - dragStart.y);
        
        // Update the Selection Box (Gizmo) while dragging
        if (id === selectedId) updateSelectionGizmo();
      }
    });
    
    const onEnd = () => {
      if (dragging) {
        dragging = false;
        viewport.pause = false;
        updateObjectState(id);
      }
    };
    
    container.on('pointerup', onEnd);
    container.on('pointerupoutside', onEnd);
    
    viewport.addChild(container);
    objectsMapRef.current.set(id, container);
    
    setSceneState(prev => ({
      ...prev,
      objects: [...prev.objects, {
        id, type: 'text',
        x: container.x, y: container.y,
        scaleX: container.scale.x, scaleY: container.scale.y,
        rotation: container.rotation, text: initialText
      }]
    }));
    
    // Auto-select the new text on creation
    setSelectedId(id);
    
  }, [updateObjectState, selectedId, updateSelectionGizmo]);

  // Add file icon to canvas
  const addFile = useCallback((filename: string) => {
    if (!viewportRef.current) return;

    const id = generateId();
    const viewport = viewportRef.current;
    
    const container = new PIXI.Container();
    
    // File icon background with shadow
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.2);
    shadow.drawRoundedRect(4, 4, 160, 180, 10);
    shadow.endFill();
    
    const bg = new PIXI.Graphics();
    bg.beginFill(0x2d2d2d);
    bg.lineStyle(2, 0x404040);
    bg.drawRoundedRect(0, 0, 160, 180, 10);
    bg.endFill();
    
    // File icon with folded corner
    const fileIcon = new PIXI.Graphics();
    fileIcon.beginFill(0x4a9eff);
    fileIcon.drawRoundedRect(35, 20, 90, 100, 5);
    fileIcon.endFill();
    
    // Folded corner
    fileIcon.beginFill(0x3a7ecf);
    fileIcon.moveTo(125, 20);
    fileIcon.lineTo(105, 20);
    fileIcon.lineTo(125, 40);
    fileIcon.lineTo(125, 20);
    fileIcon.endFill();
    
    // Document lines
    const lines = new PIXI.Graphics();
    lines.lineStyle(2, 0xffffff, 0.3);
    for (let i = 0; i < 5; i++) {
      lines.moveTo(45, 40 + i * 12);
      lines.lineTo(115, 40 + i * 12);
    }
    
    // File extension badge
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
    
    // Filename text
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
    
    // Make interactive (v7+ way)
    container.eventMode = 'static';
    container.cursor = 'pointer';
    
    // Drag functionality
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    
    container.on('pointerdown', (e: any) => {
      dragging = true;
      const pos = e.data.getLocalPosition(container.parent);
      dragStart = { x: pos.x - container.x, y: pos.y - container.y };
      viewport.pause = true;
      e.stopPropagation();
    });
    
    container.on('pointermove', (e: any) => {
      if (dragging) {
        const pos = e.data.getLocalPosition(container.parent);
        container.position.set(pos.x - dragStart.x, pos.y - dragStart.y);
        e.stopPropagation();
      }
    });
    
    container.on('pointerup', () => {
      if (dragging) {
        dragging = false;
        viewport.pause = false;
        updateObjectState(id);
      }
    });
    
    container.on('pointerupoutside', () => {
      if (dragging) {
        dragging = false;
        viewport.pause = false;
        updateObjectState(id);
      }
    });
    
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
  }, [updateObjectState]);

  // Handle text editing
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

  // File upload handlers
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
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

  // Save scene
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

  // Load scene
  const loadScene = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const loaded: SceneState = JSON.parse(ev.target?.result as string);
        
        // Clear existing objects
        objectsMapRef.current.forEach(obj => obj.destroy({ children: true }));
        objectsMapRef.current.clear();
        videoElementsRef.current.forEach(video => {
          video.pause();
          video.src = '';
        });
        videoElementsRef.current.clear();
        
        // Restore objects
        loaded.objects.forEach(obj => {
          if (obj.type === 'image' && obj.source) {
            addImage(obj.source);
          } else if (obj.type === 'video' && obj.source) {
            addVideo(obj.source);
          } else if (obj.type === 'text' && obj.text) {
            addText(obj.text);
          } else if (obj.type === 'file' && obj.filename) {
            addFile(obj.filename);
          }
        });
        
        // Restore camera
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

  // Camera controls
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
      {/* Canvas Container */}
      <div
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            touchAction: 'none',      // ⬅️ REQUIRED
            overscrollBehavior: 'none'
          }}
        />
      {/* Toolbar */}
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