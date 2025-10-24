import React, { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

// Define types for Fabric.js objects (extend as needed)
declare module 'fabric' {
  interface ITextOptions {
    // Custom options if needed
  }
}

interface CanvasEditorProps {
  width?: number;
  height?: number;
  backgroundColor?: string;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({
  width = 800,
  height = 600,
  backgroundColor = '#ffffff',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric.js canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor,
      selection: true, // Enable multi-selection
      preserveObjectStacking: true, // Preserve layer order
    });

    fabricCanvasRef.current = canvas;

    // Cleanup on unmount
    return () => {
      canvas.dispose();
    };
  }, [width, height, backgroundColor]);

  // Helper to get mouse position for adding elements
  const getCanvasPointer = (e: React.MouseEvent) => {
    if (!fabricCanvasRef.current) return { x: width / 2, y: height / 2 };
    return fabricCanvasRef.current.getPointer(e as any);
  };

  // Add text element
  const addText = (e: React.MouseEvent) => {
    if (!fabricCanvasRef.current) return;

    const pointer = getCanvasPointer(e);
    const text = new fabric.IText('Editable Text', {
      left: pointer.x,
      top: pointer.y,
      fontFamily: 'Arial',
      fontSize: 20,
      fill: '#333',
      editable: true, // Allows inline editing
    });

    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text); // Select for immediate editing
    fabricCanvasRef.current.renderAll();
  };

  // Add image element (from URL)
  const addImage = async (e: React.MouseEvent, imageUrl: string) => {
    if (!fabricCanvasRef.current) return;

    try {
      const pointer = getCanvasPointer(e);
      const imgElement = await fabric.Image.fromURL(imageUrl, {
        left: pointer.x,
        top: pointer.y,
        scaleX: 0.5, // Scale down for demo
        scaleY: 0.5,
        selectable: true,
        hasControls: true, // Enable resize handles
      });

      fabricCanvasRef.current.add(imgElement);
      fabricCanvasRef.current.renderAll();
    } catch (error) {
      console.error('Failed to load image:', error);
    }
  };

  // Add video element (from URL; note: videos need a <video> source)
  const addVideo = async (e: React.MouseEvent, videoUrl: string) => {
    if (!fabricCanvasRef.current) return;

    try {
      const pointer = getCanvasPointer(e);
      // Fabric.js video support requires a video element
      const videoElement = document.createElement('video');
      videoElement.src = videoUrl;
      videoElement.crossOrigin = 'anonymous'; // For CORS if needed
      videoElement.width = 200;
      videoElement.height = 150;

      const video = new fabric.Image(videoElement, {
        left: pointer.x,
        top: pointer.y,
        scaleX: 0.5,
        scaleY: 0.5,
        selectable: true,
        hasControls: true,
      });

      // Play video on add (optional)
      videoElement.play().catch(console.error);

      fabricCanvasRef.current.add(video);
      fabricCanvasRef.current.renderAll();
    } catch (error) {
      console.error('Failed to load video:', error);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} />
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.8)',
          padding: '10px',
          borderRadius: '5px',
        }}
      >
        <button onClick={(e) => addText(e)}>Add Text</button>{' '}
        <button onClick={(e) => addImage(e, 'https://via.placeholder.com/400x300/ff6b6b/ffffff?text=Image')}>
          Add Image
        </button>{' '}
        <button onClick={(e) => addVideo(e, 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4')}>
          Add Video
        </button>
        <p>Click buttons or drag elements around!</p>
      </div>
    </div>
  );
};

export default CanvasEditor;