import React, { useEffect, useRef, useState, useCallback } from "react";
import * as fabric from 'fabric';

interface CanvasData {
  version: string;
  objects: fabric.Object[];
  background: string;
  canvasWidth: number;
  canvasHeight: number;
  viewport: {
    zoom: number;
    pan: { x: number; y: number };
  };
}

interface VideoObject extends fabric.Group {
  videoElement?: HTMLVideoElement;
  isPlaying?: boolean;
  _stopAnimation?: () => void;
}

const InfiniteCanvas: React.FC = () => {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const isPanningRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoElementsRef = useRef<HTMLVideoElement[]>([]);
  const renderThrottleRef = useRef<number | null>(null);

  // --- FILE ICON HELPER ---
  const getFileIcon = (type: string, name: string): string => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return '📝';
    if (type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx')) return '📊';
    if (type.includes('powerpoint') || name.endsWith('.ppt') || name.endsWith('.pptx')) return '📊';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '📦';
    if (type.includes('audio') || name.endsWith('.mp3') || name.endsWith('.wav')) return '🎵';
    if (name.endsWith('.exe') || name.endsWith('.msi')) return '⚙️';
    if (name.endsWith('.txt')) return '📃';
    if (type.includes('json') || name.endsWith('.json')) return '🔧';
    if (type.includes('xml') || name.endsWith('.xml')) return '🔧';
    return '📎';
  };

  // --- FORMAT FILE SIZE ---
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // --- HANDLE FILE ADDITION ---
  const handleFileAdd = useCallback((file: File, x: number, y: number) => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;

    console.log("Adding file:", file.name, file.type, { x, y });

    // IMAGES
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgSrc = e.target?.result as string;
        fabric.Image.fromURL(imgSrc).then((img) => {
          if (!img) {
            console.error("Failed to create image");
            return;
          }

          const maxWidth = 300;
          const maxHeight = 300;
          const iw = img.width || maxWidth;
          const ih = img.height || maxHeight;

          const scale = Math.min(maxWidth / iw, maxHeight / ih, 1);

          img.set({
            left: x,
            top: y,
            scaleX: scale,
            scaleY: scale,
            selectable: true,
            hasControls: true,
            objectCaching: true,
            statefullCache: true,
          });

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.requestRenderAll();
        }).catch((err) => {
          console.error("Error loading image:", err);
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // VIDEOS - With centered play button + mute (no bottom bar)
    if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      const videoEl = document.createElement("video");

      videoEl.src = url;
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('webkit-playsinline', '');
      videoEl.style.position = 'absolute';
      videoEl.style.top = '-10000px';
      videoEl.style.left = '-10000px';

      document.body.appendChild(videoEl);
      videoElementsRef.current.push(videoEl);

      const addVideoToCanvas = () => {
        const vw = videoEl.videoWidth || 640;
        const vh = videoEl.videoHeight || 480;

        videoEl.width = vw;
        videoEl.height = vh;

        const maxWidth = 300;
        const maxHeight = 300;
        const scale = Math.min(maxWidth / vw, maxHeight / vh, 1);

        const scaledW = vw * scale;
        const scaledH = vh * scale;

        const centerX = scaledW / 2;
        const centerY = scaledH / 2;

        // Fabric image using the video element
        const videoFabricImage = new fabric.Image(videoEl, {
          left: 0,
          top: 0,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          objectCaching: false,
        });

        // Centered play button circle (origin=center)
        const playRadius = 30;
        const playButton = new fabric.Circle({
          radius: playRadius,
          fill: 'rgba(0,0,0,0.7)',
          left: centerX,
          top: centerY,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });

        // Centered play triangle (origin=center)
        const playIcon = new fabric.Polygon([
          { x: -10, y: -15 },
          { x: -10, y: 15 },
          { x: 15, y: 0 }
        ], {
          fill: 'white',
          left: centerX,
          top: centerY,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });

        // Mute icon in bottom-right corner
        const muteIcon = new fabric.Text('🔇', {
          fontSize: 20,
          left: scaledW - 10,
          top: scaledH - 10,
          originX: 'right',
          originY: 'bottom',
          selectable: false,
          evented: true,
        });

        // Build group (no control bar)
        const videoGroup = new fabric.Group(
          [videoFabricImage, playButton, playIcon, muteIcon],
          {
            left: x,
            top: y,
            selectable: true,
            hasControls: true,
            objectCaching: false,
          }
        ) as VideoObject;

        videoGroup.videoElement = videoEl;
        videoGroup.isPlaying = false;

        // RAF id for the render loop
        let rafId: number | null = null;
        const startRenderLoop = () => {
          if (!fabricCanvasRef.current) return;
          const cvs = fabricCanvasRef.current;
          const loop = () => {
            if (!videoGroup.isPlaying) return;
            try { 
              cvs.requestRenderAll(); 
            } catch (error) { 
              console.warn('Render error:', error);
            }
            rafId = requestAnimationFrame(loop);
          };
          rafId = requestAnimationFrame(loop);
        };
        const stopRenderLoop = () => {
          if (rafId !== null) {
            try { 
              cancelAnimationFrame(rafId); 
            } catch (error) {
              console.warn('Cancel animation error:', error);
            }
            rafId = null;
          }
        };

        // Click handling
        videoGroup.on('mousedown', (e) => {
          if (!fabricCanvasRef.current) return;
          const cvs = fabricCanvasRef.current;

          const pointer = cvs.getPointer(e.e as MouseEvent);
          const groupBounds = videoGroup.getBoundingRect();

          const relativeX = pointer.x - groupBounds.left;
          const relativeY = pointer.y - groupBounds.top;

          const scaledWidth = groupBounds.width;
          const scaledHeight = groupBounds.height;

          // calculate mute area
          const muteButtonArea = {
            left: scaledWidth - 45,
            top: scaledHeight - 45,
            width: 40,
            height: 40,
          };

          // Toggle mute
          if (
            relativeX >= muteButtonArea.left &&
            relativeX <= muteButtonArea.left + muteButtonArea.width &&
            relativeY >= muteButtonArea.top &&
            relativeY <= muteButtonArea.top + muteButtonArea.height
          ) {
            videoEl.muted = !videoEl.muted;
            muteIcon.set('text', videoEl.muted ? '🔇' : '🔊');
            videoGroup.setCoords();
            cvs.requestRenderAll();
            return;
          }

          // Toggle play/pause
          if (videoGroup.isPlaying) {
            stopRenderLoop();
            try { 
              videoEl.pause(); 
            } catch (error) {
              console.warn('Pause error:', error);
            }
            videoGroup.isPlaying = false;
            playButton.set('visible', true);
            playIcon.set('visible', true);
            videoGroup.setCoords();
            cvs.requestRenderAll();
          } else {
            videoEl.play()
              .then(() => {
                videoGroup.isPlaying = true;
                playButton.set('visible', false);
                playIcon.set('visible', false);
                videoGroup.setCoords();
                startRenderLoop();
              })
              .catch(err => {
                console.warn('video play() failed:', err);
                videoGroup.isPlaying = false;
                alert('Unable to play video automatically. Try interacting with the page (click) to allow playback.');
              });
          }

          cvs.requestRenderAll();
        });

        // Cleanup when the object is removed
        videoGroup._stopAnimation = () => {
          try { stopRenderLoop(); } catch (error) { console.warn('Stop render loop error:', error); }
          try { videoEl.pause(); } catch (error) { console.warn('Video pause error:', error); }
          videoGroup.isPlaying = false;
          try {
            playButton.set('visible', true);
            playIcon.set('visible', true);
            videoGroup.setCoords();
            if (fabricCanvasRef.current) fabricCanvasRef.current.requestRenderAll();
          } catch (error) { 
            console.warn('Button visibility error:', error);
          }
        };

        canvas.add(videoGroup);
        canvas.setActiveObject(videoGroup);
        canvas.requestRenderAll();
      };

      videoEl.addEventListener('loadedmetadata', addVideoToCanvas);
      videoEl.addEventListener('error', () => {
        console.error("Video error");
        alert("Failed to load video. The file might be corrupted or in an unsupported format.");
        if (videoEl.parentNode) document.body.removeChild(videoEl);
        URL.revokeObjectURL(url);
      });

      videoEl.load();
      return;
    }

    // OTHER FILES
    const fileIcon = getFileIcon(file.type, file.name);
    const fileName =
      file.name.length > 30 ? file.name.substring(0, 30) + "..." : file.name;
    const fileSize = formatFileSize(file.size);

    const rect = new fabric.Rect({
      width: 200,
      height: 100,
      fill: "#ffffff",
      stroke: "#333",
      strokeWidth: 2,
      rx: 8,
      ry: 8,
      shadow: new fabric.Shadow({
        color: "rgba(0,0,0,0.2)",
        blur: 10,
        offsetX: 2,
        offsetY: 2,
      }),
    });

    const icon = new fabric.Text(fileIcon, {
      fontSize: 40,
      left: 10,
      top: 15,
    });

    const nameText = new fabric.Text(fileName, {
      left: 10,
      top: 65,
      fontSize: 12,
      fontWeight: "bold",
    });

    const sizeText = new fabric.Text(fileSize, {
      left: 10,
      top: 82,
      fontSize: 10,
      fill: "#666",
    });

    const group = new fabric.Group([rect, icon, nameText, sizeText], {
      left: x,
      top: y,
      selectable: true,
      hasControls: true,
    });

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
  }, []);

  // Helper: get viewport center
  const getViewportCenter = useCallback(() => {
    if (!fabricCanvasRef.current) {
      return { x: 100, y: 100 };
    }
    const canvas = fabricCanvasRef.current;
    const vpt = canvas.viewportTransform;

    const zoom = canvas.getZoom();
    const offsetX = vpt[4];
    const offsetY = vpt[5];

    const centerX = (window.innerWidth / 2 - offsetX) / zoom;
    const centerY = (window.innerHeight / 2 - offsetY) / zoom;

    return { x: centerX, y: centerY };
  }, []);

  useEffect(() => {
    if (!canvasElementRef.current) return;

    const fabricCanvas = new fabric.Canvas(canvasElementRef.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "#f0f0f0",
      preserveObjectStacking: true,
      renderOnAddRemove: true,
      skipTargetFind: false,
      enableRetinaScaling: true,
      allowTouchScrolling: false,
    });
    fabricCanvasRef.current = fabricCanvas;

    // Cleanup-on-remove handler
// typed handler for object:removed (has opt.target)
 const handleObjectRemoved = (opt: { target: fabric.Object }) => {
      try {
        const obj = opt.target as VideoObject | undefined;
        if (!obj) return;
        
        if (obj.videoElement instanceof HTMLVideoElement) {
          const v: HTMLVideoElement = obj.videoElement;
          try { 
            if (typeof obj._stopAnimation === 'function') obj._stopAnimation(); 
          } catch (error) {
            console.warn('Stop animation error:', error);
          }
          try {
            if (v.parentNode) {
              v.pause();
              v.parentNode.removeChild(v);
            }
          } catch (error) { 
            console.warn('Video removal error:', error);
          }
          try {
            if (v.src && v.src.startsWith('blob:')) {
              URL.revokeObjectURL(v.src);
            }
          } catch (error) { 
            console.warn('URL revoke error:', error);
          }
        }
      } catch (error) {
        console.warn('object:removed handler error', error);
      }
    };

    fabricCanvas.on('object:removed', handleObjectRemoved);


    // Make canvas non-interactive in view mode
    if (mode === 'view') {
      fabricCanvas.selection = false;
      fabricCanvas.forEachObject(obj => {
        obj.selectable = false;
        obj.evented = false;
      });
    }

    // --- PANNING ---
    const handleMouseDown = (opt: fabric.TEvent) => {
      const evt = opt.e as MouseEvent;
      if (mode === 'edit' && (evt.altKey || evt.button === 1)) {
        isPanningRef.current = true;
        lastPosRef.current = { x: evt.clientX, y: evt.clientY };
        fabricCanvas.setCursor("grab");
        fabricCanvas.selection = false;
        evt.preventDefault();
      }
    };

    const handleMouseMove = (opt: fabric.TEvent) => {
      if (!isPanningRef.current || !lastPosRef.current) return;
      const evt = opt.e as MouseEvent;
      const deltaX = evt.clientX - lastPosRef.current.x;
      const deltaY = evt.clientY - lastPosRef.current.y;

      if (renderThrottleRef.current) {
        clearTimeout(renderThrottleRef.current);
      }

      fabricCanvas.relativePan(new fabric.Point(deltaX, deltaY));
      lastPosRef.current = { x: evt.clientX, y: evt.clientY };

      renderThrottleRef.current = window.setTimeout(() => {
        fabricCanvas.requestRenderAll();
      }, 16);
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
      lastPosRef.current = null;
      fabricCanvas.setCursor("default");
      if (mode === 'edit') fabricCanvas.selection = true;
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    fabricCanvas.on("mouse:move", handleMouseMove);
    fabricCanvas.on("mouse:up", handleMouseUp);

    // --- ZOOM ---
    const handleWheel = (opt: fabric.TEvent) => {
      const evt = opt.e as WheelEvent;
      evt.preventDefault();

      const delta = evt.deltaY;
      let newZoom = fabricCanvas.getZoom();
      newZoom *= 0.999 ** delta;

      if (newZoom > 5) newZoom = 5;
      if (newZoom < 0.1) newZoom = 0.1;

      const point = new fabric.Point(evt.offsetX, evt.offsetY);
      fabricCanvas.zoomToPoint(point, newZoom);
      setZoom(newZoom);
    };

    fabricCanvas.on("mouse:wheel", handleWheel);

    // --- AUTO-EXPAND ---
    const expandCanvas = (obj: fabric.Object) => {
      if (mode === 'view') return;

      const bounds = obj.getBoundingRect();
      const padding = 500;

      let newWidth = fabricCanvas.getWidth();
      let newHeight = fabricCanvas.getHeight();

      if (bounds.left + bounds.width + padding > newWidth) {
        newWidth = bounds.left + bounds.width + padding;
      }
      if (bounds.top + bounds.height + padding > newHeight) {
        newHeight = bounds.top + bounds.height + padding;
      }

      if (bounds.left < 0) {
        const shift = Math.abs(bounds.left) + padding;
        fabricCanvas.getObjects().forEach(o => {
          o.set({ left: (o.left || 0) + shift });
        });
        newWidth += shift;
      }
      if (bounds.top < 0) {
        const shift = Math.abs(bounds.top) + padding;
        fabricCanvas.getObjects().forEach(o => {
          o.set({ top: (o.top || 0) + shift });
        });
        newHeight += shift;
      }

      fabricCanvas.setDimensions({ width: newWidth, height: newHeight });
    };

    if (mode === 'edit') {
      fabricCanvas.on("object:moving", (opt) => {
        if (opt.target) expandCanvas(opt.target);
      });
      fabricCanvas.on("object:modified", (opt) => {
        if (opt.target) expandCanvas(opt.target);
      });
    }

    // --- RESIZE ---
    const handleResize = () => {
      fabricCanvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);

    // --- DRAG & DROP ---
    const handleDocDragOver = (e: DragEvent) => e.preventDefault();
    const handleDocDrop = (e: DragEvent) => e.preventDefault();

    if (mode === 'edit') {
      document.addEventListener("dragover", handleDocDragOver);
      document.addEventListener("drop", handleDocDrop);
    }

    const wrapperEl = fabricCanvas.wrapperEl as HTMLDivElement | undefined;
    const handleCanvasDrop = (e: DragEvent) => {
      if (mode === 'view') return;
      e.preventDefault();
      if (!fabricCanvasRef.current) return;

      const canvas = fabricCanvasRef.current;
      const pointer = canvas.getScenePoint(e);
      const files = e.dataTransfer?.files;
      const textData = e.dataTransfer?.getData("text/plain");

      if (files && files.length > 0) {
        Array.from(files).forEach((file, index) => {
          const offset = index * 100;
          handleFileAdd(file, pointer.x + offset, pointer.y + offset);
        });
      } else if (textData) {
        const text = new fabric.Textbox(textData, {
          left: pointer.x,
          top: pointer.y,
          fontSize: 16,
          width: 300,
          fill: '#000',
        });
        canvas.add(text);
        canvas.requestRenderAll();
      }
    };

    if (wrapperEl && mode === 'edit') {
      wrapperEl.addEventListener("drop", handleCanvasDrop);
    }

    // Load saved data if in view mode
    if (mode === 'view' && canvasData) {
      fabricCanvas.loadFromJSON(canvasData).then(() => {
        fabricCanvas.setDimensions({
          width: canvasData.canvasWidth,
          height: canvasData.canvasHeight,
        });
        fabricCanvas.setViewportTransform([
          canvasData.viewport.zoom,
          0,
          0,
          canvasData.viewport.zoom,
          canvasData.viewport.pan.x,
          canvasData.viewport.pan.y,
        ]);
        setZoom(canvasData.viewport.zoom);
        fabricCanvas.requestRenderAll();
      });
    }

    // --- CLEANUP ---
    return () => {
      videoElementsRef.current.forEach(video => {
        try { video.pause(); } catch (error) { console.warn('Video pause error:', error); }
        if (video.parentNode) {
          try { video.parentNode.removeChild(video); } catch (error) { console.warn('Video removal error:', error); }
        }
        try {
          if (video.src && video.src.startsWith('blob:')) {
            URL.revokeObjectURL(video.src);
          }
        } catch (error) { console.warn('URL revoke error:', error); }
      });
      videoElementsRef.current = [];

      if (renderThrottleRef.current) {
        clearTimeout(renderThrottleRef.current);
      }

      fabricCanvas.off("mouse:down", handleMouseDown);
      fabricCanvas.off("mouse:move", handleMouseMove);
      fabricCanvas.off("mouse:up", handleMouseUp);
      fabricCanvas.off("mouse:wheel", handleWheel);

      try { fabricCanvas.off('object:removed', handleObjectRemoved); } catch (error) { console.warn('Event cleanup error:', error); }
      try { fabricCanvas.off("object:moving"); } catch (error) { console.warn('Event cleanup error:', error); }
      try { fabricCanvas.off("object:modified"); } catch (error) { console.warn('Event cleanup error:', error); }

      window.removeEventListener("resize", handleResize);
      document.removeEventListener("dragover", handleDocDragOver);
      document.removeEventListener("drop", handleDocDrop);
      if (wrapperEl) {
        wrapperEl.removeEventListener("drop", handleCanvasDrop);
      }
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [mode, canvasData, handleFileAdd]);

  // --- IMAGE UPLOAD ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fabricCanvasRef.current) return;

    const center = getViewportCenter();

    Array.from(files).forEach((file, index) => {
      const offset = index * 100;
      handleFileAdd(file, center.x + offset, center.y + offset);
    });

    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // --- VIDEO UPLOAD ---
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fabricCanvasRef.current) return;

    const center = getViewportCenter();

    Array.from(files).forEach((file, index) => {
      const offset = index * 100;
      handleFileAdd(file, center.x + offset, center.y + offset);
    });

    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  // --- ANY FILE UPLOAD ---
  const handleAnyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fabricCanvasRef.current) return;

    const center = getViewportCenter();

    Array.from(files).forEach((file, index) => {
      const offset = index * 100;
      handleFileAdd(file, center.x + offset, center.y + offset);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- ADD TEXT BOX ---
  const addTextBox = () => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;

    const center = getViewportCenter();

    const text = new fabric.Textbox('Type here...', {
      left: center.x,
      top: center.y,
      width: 300,
      fontSize: 20,
      padding: 10,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  };

  // --- SAVE CANVAS ---
  const handleSave = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const json = canvas.toJSON();
    const vpt = canvas.viewportTransform;

    const data: CanvasData = {
      version: '1.0',
      objects: json.objects,
      background: json.background,
      canvasWidth: canvas.getWidth(),
      canvasHeight: canvas.getHeight(),
      viewport: {
        zoom: canvas.getZoom(),
        pan: { x: vpt[4], y: vpt[5] },
      },
    };

    setCanvasData(data);

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devlog_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert('Canvas saved! ✅');
  };

  // --- LOAD CANVAS ---
  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setCanvasData(data);
          setMode('view');
          setTimeout(() => setMode('edit'), 100);
        } catch (err) {
          console.error('Failed to load canvas file:', err);
          alert('Failed to load canvas file!');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // --- DELETE SELECTED ---
  const deleteSelected = () => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const active = canvas.getActiveObject();
    if (active) {
      const videoObj = active as VideoObject;
      if (videoObj._stopAnimation) {
        videoObj._stopAnimation();
      }
      canvas.remove(active);
      canvas.requestRenderAll();
    }
  };

  // --- CLEAR CANVAS ---
  const clearCanvas = () => {
    if (!fabricCanvasRef.current) return;
    if (window.confirm('Clear entire canvas?')) {
      fabricCanvasRef.current.getObjects().forEach(obj => {
        const videoObj = obj as VideoObject;
        if (videoObj._stopAnimation) {
          videoObj._stopAnimation();
        }
      });
      fabricCanvasRef.current.clear();
      fabricCanvasRef.current.backgroundColor = "#f0f0f0";
      fabricCanvasRef.current.requestRenderAll();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas ref={canvasElementRef} />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleVideoUpload}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleAnyFileUpload}
      />

      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: 'rgba(255,255,255,0.95)',
        padding: '12px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        maxWidth: '90vw',
      }}>
        {mode === 'edit' ? (
          <>
            <button onClick={addTextBox} style={buttonStyle}>📝 Add Text</button>
            <button onClick={() => imageInputRef.current?.click()} style={buttonStyle}>
              🖼️ Add Image
            </button>
            <button onClick={() => videoInputRef.current?.click()} style={buttonStyle}>
              🎥 Add Video
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={buttonStyle}>
              📁 Add Any File
            </button>
            <button onClick={deleteSelected} style={{...buttonStyle, background: '#ff4444', color: 'white'}}>
              🗑️ Delete
            </button>
            <button onClick={clearCanvas} style={{...buttonStyle, background: '#ff6666', color: 'white'}}>
              Clear All
            </button>
            <button onClick={handleSave} style={{...buttonStyle, background: '#4CAF50', color: 'white'}}>
              💾 Save
            </button>
            <button onClick={handleLoad} style={{...buttonStyle, background: '#2196F3', color: 'white'}}>
              📂 Load
            </button>
          </>
        ) : (
          <button onClick={() => setMode('edit')} style={{...buttonStyle, background: '#FF9800', color: 'white'}}>
            ✏️ Edit Mode
          </button>
        )}
      </div>

      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: 4,
        fontSize: 12,
        fontFamily: 'monospace'
      }}>
        {mode === 'view' ? '👁️ VIEW' : '✏️ EDIT'} | Zoom: {(zoom * 100).toFixed(0)}%
      </div>

      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: 4,
        fontSize: 11,
        maxWidth: '400px',
      }}>
        {mode === 'edit' ? (
          <>
            🖱️ <strong>Drag & Drop</strong> any file anywhere<br/>
            🖼️ <strong>Images/Videos</strong> display directly on canvas<br/>
            📄 <strong>PDFs/Docs/EXE</strong> show as file cards<br/>
            ⌨️ <strong>Alt+Drag</strong> to pan | 🔍 <strong>Scroll</strong> to zoom<br/>
            ↔️ <strong>Drag corners</strong> to resize | 🔄 <strong>Rotate</strong> with handle
          </>
        ) : (
          <>
            👁️ Viewing saved canvas | Alt+Drag to pan | Scroll to zoom
          </>
        )}
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  background: '#f0f0f0',
  transition: 'all 0.2s',
  whiteSpace: 'nowrap',
};

export default InfiniteCanvas;
