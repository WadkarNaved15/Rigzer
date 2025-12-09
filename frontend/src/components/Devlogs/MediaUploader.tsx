import React, { useRef } from "react";
import type { PageData, Media, FileItem, BlogSection,ExcalidrawItem } from "../../types/Devlogs";

interface MediaUploaderProps {
  setPageData: React.Dispatch<React.SetStateAction<PageData>>;
  setLeftColumnCards: React.Dispatch<React.SetStateAction<string[]>>;
  setRightColumnCards: React.Dispatch<React.SetStateAction<string[]>>;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
  setPageData,
  setLeftColumnCards,
  setRightColumnCards,
}) => {
  const screenshotRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newMedia: Media[] = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type,
      id: `screenshot-${Date.now()}-${Math.random()}`,
    }));

    setPageData((prev) => ({
      ...prev,
      screenshots: [...prev.screenshots, ...newMedia],
    }));

    // Add each screenshot as a draggable card to the left column
    setLeftColumnCards((prev) => [
      ...prev,
      ...newMedia.map((m) => m.id),
    ]);

    e.target.value = "";
  };

  const handleAddExcalidraw = () => {
  const newExcalidraw: ExcalidrawItem = {
    id: `excalidraw-${Date.now()}-${Math.random()}`,
    elements: [],
    appState: {},
  };

  setPageData(prev => ({
    ...prev,
    excalidraws: [...prev.excalidraws, newExcalidraw],
  }));

  setLeftColumnCards(prev => [...prev, newExcalidraw.id]);
};


  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newMedia: Media[] = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type,
      id: `video-${Date.now()}-${Math.random()}`,
    }));

    setPageData((prev) => ({
      ...prev,
      videos: [...prev.videos, ...newMedia],
    }));

    // Add each video as a draggable card to the left column
    setLeftColumnCards((prev) => [
      ...prev,
      ...newMedia.map((m) => m.id),
    ]);

    e.target.value = "";
  };

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newFiles: FileItem[] = files.map((file) => ({
      id: `file-${Date.now()}-${Math.random()}`,
      file,
      title: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      url: URL.createObjectURL(file),
    }));

    setPageData((prev) => ({
      ...prev,
      files: [...prev.files, ...newFiles],
    }));

    // Add each file as a draggable card to the left column
    setLeftColumnCards((prev) => [
      ...prev,
      ...newFiles.map((f) => f.id) as string[],
    ]);

    e.target.value = "";
  };

  const handleAddBlogSection = () => {
    const newBlogSection: BlogSection = {
      id: `blog-${Date.now()}-${Math.random()}`,
      content: "",
    };

    setPageData((prev) => ({
      ...prev,
      blogSections: [...prev.blogSections, newBlogSection],
    }));

    // Add the blog section as a draggable card to the left column
    setLeftColumnCards((prev) => [...prev, newBlogSection.id]);
  };

  return (
    <>
    <button
        type="button"
        className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded shadow"
        onClick={handleAddExcalidraw}
      >
        + Excalidraw
      </button>
      <button
        type="button"
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded shadow"
        onClick={() => screenshotRef.current?.click()}
      >
        Upload Screenshot
      </button>
      <input
        type="file"
        accept="image/*"
        ref={screenshotRef}
        hidden
        multiple
        onChange={handleScreenshotUpload}
      />

      <button
        type="button"
        className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded shadow"
        onClick={() => videoRef.current?.click()}
      >
        Upload Video
      </button>
      <input
        type="file"
        accept="video/*"
        ref={videoRef}
        hidden
        multiple
        onChange={handleVideoUpload}
      />

      <button
        type="button"
        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded shadow"
        onClick={() => filesRef.current?.click()}
      >
        Upload Files
      </button>
      <input
        type="file"
        ref={filesRef}
        hidden
        multiple
        onChange={handleFilesUpload}
      />

      <button
        type="button"
        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded shadow"
        onClick={handleAddBlogSection}
      >
        + Blog Section
      </button>
    </>
  );
};

export default MediaUploader;