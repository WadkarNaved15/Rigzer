import React, { useState, useRef } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import type { PageData, Media } from "../types/Devlogs";
import GameLogo from "../components/Devlogs/GameLogo";
import Blog from "../components/Devlogs/Blog";
import Files from "../components/Devlogs/Files";
import Purchase from "../components/Devlogs/Purchase";
import SideBar from "../components/Devlogs/SideBar";
import GameInfo from "../components/Devlogs/GameInfo";
import MediaUploader from "../components/Devlogs/MediaUploader";
import DraggableScreenshot from "../components/Devlogs/DraggableImage";
import DraggableVideo from "../components/Devlogs/DraggableVideo";
import DraggableFile from "../components/Devlogs/DraggableFile";
import DraggableBlog from "../components/Devlogs/DraggableBlog";
import axios from "axios";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { AppState, ExcalidrawElement } from "@excalidraw/excalidraw";

function DevLogs() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const [pageData, setPageData] = useState<PageData>({
    gameTitle: "TITLE",
    postTitle: "Post Title",
    postTag: "Devlog",
    postDate: "1 day ago",
    author: "Author Name",
    italicQuote: "Bonjour mes amis!",
    bodyParagraph1: "Some free bonus extra content...",
    bodyParagraph2: "The complete soundtrack...",
    bodyParagraph3: "Also, some good news...",
    storeLink: "https://psytronik.bigcartel.com/products",
    closingQuote: "Have fun & keep it RETRO",
    signature: "Kenz / www.psytronik.net",
    files: [],
    price: "$3.99 USD",
    gameInfoTitle: "Game Info Title",
    gameInfoDescription: "An excellent swashbuckling action-adventure for the C64!",
    gameDetails: {
      status: "Released",
      author: "Psytronik Software",
      genre: "Action, Adventure",
      tags: "Arcade, Commodore 64, Retro",
    },
    screenshots: [],
    videos: [],
    bgImage: null,
    gameTitleImage: null,
    blogSections: [],
    excalidraws: [],
  });

  const [leftColumnCards, setLeftColumnCards] = useState([
    "GameLogo",
    "Purchase",
  ]);

  const [rightColumnCards, setRightColumnCards] = useState(["GameInfo", "SideBar"]);
  const [gradientColor, setGradientColor] = useState("0, 0, 0");
  const bgImageRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    setGradientColor(`${r}, ${g}, ${b}`);
  };

  const handleSelectMedia = (key: keyof PageData, file: File) => {
    const media: Media = { 
      file, 
      url: URL.createObjectURL(file), 
      type: file.type,
      id: `${key}-${Date.now()}`,
    };
    setPageData((prev) => ({
      ...prev,
      [key]: media,
    }));
  };

  const handleChange = (
    field: string,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setPageData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleRemoveMedia = (id: string) => {
    // Remove from pageData
    setPageData((prev) => {
      const screenshot = prev.screenshots.find((s) => s.id === id);
      const video = prev.videos.find((v) => v.id === id);
      const file = prev.files.find((f) => f.id === id);
      const blogSection = prev.blogSections.find((b) => b.id === id);
      
      if (screenshot) {
        URL.revokeObjectURL(screenshot.url);
        return {
          ...prev,
          screenshots: prev.screenshots.filter((s) => s.id !== id),
        };
      }
      
      if (video) {
        URL.revokeObjectURL(video.url);
        return {
          ...prev,
          videos: prev.videos.filter((v) => v.id !== id),
        };
      }

      if (file) {
        URL.revokeObjectURL(file.url);
        return {
          ...prev,
          files: prev.files.filter((f) => f.id !== id),
        };
      }

      if (blogSection) {
        return {
          ...prev,
          blogSections: prev.blogSections.filter((b) => b.id !== id),
        };
      }
      
      return prev;
    });

    // Remove from column layout
    setLeftColumnCards((prev) => prev.filter((card) => card !== id));
    setRightColumnCards((prev) => prev.filter((card) => card !== id));
  };

  const handleUpdateBlogSection = (id: string, content: string) => {
    setPageData((prev) => ({
      ...prev,
      blogSections: prev.blogSections.map((blog) =>
        blog.id === id ? { ...blog, content } : blog
      ),
    }));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const isSourceLeft = leftColumnCards.includes(active.id);
    const isDestinationLeft = leftColumnCards.includes(over.id);

    if (isSourceLeft && isDestinationLeft) {
      setLeftColumnCards((items) =>
        arrayMove(items, items.indexOf(active.id), items.indexOf(over.id))
      );
    } else if (!isSourceLeft && !isDestinationLeft) {
      setRightColumnCards((items) =>
        arrayMove(items, items.indexOf(active.id), items.indexOf(over.id))
      );
    } else {
      if (isSourceLeft) {
        const newLeft = leftColumnCards.filter((item) => item !== active.id);
        const overIndex = rightColumnCards.indexOf(over.id);
        const newRight = [
          ...rightColumnCards.slice(0, overIndex),
          active.id,
          ...rightColumnCards.slice(overIndex),
        ];
        setLeftColumnCards(newLeft);
        setRightColumnCards(newRight);
      } else {
        const newRight = rightColumnCards.filter((item) => item !== active.id);
        const overIndex = leftColumnCards.indexOf(over.id);
        const newLeft = [
          ...leftColumnCards.slice(0, overIndex),
          active.id,
          ...leftColumnCards.slice(overIndex),
        ];
        setRightColumnCards(newRight);
        setLeftColumnCards(newLeft);
      }
    }
  };

  

  const renderCard = (card: string) => {
    // Check if it's a screenshot
    const screenshot = pageData.screenshots.find((s) => s.id === card);
    if (screenshot) {
      return (
        <DraggableScreenshot
          key={card}
          id={card}
          media={screenshot}
          onRemove={handleRemoveMedia}
        />
      );
    }

    const excalidraw = pageData.excalidraws.find((e) => e.id === card);
if (excalidraw) {
  return (
    <div key={card} className="border rounded shadow">
      <Excalidraw
        initialData={{ elements: excalidraw.elements, appState: excalidraw.appState }}
        onChange={(elements: readonly ExcalidrawElement[], state: AppState) => {
  setPageData((prev) => ({
    ...prev,
    excalidraws: prev.excalidraws.map((ex) =>
      ex.id === card ? { ...ex, elements: [...elements], appState: state } : ex
    ),
  }));
}}
      />
      <button className="mt-2 text-red-600" onClick={() => handleRemoveMedia(card)}>
        Remove
      </button>
    </div>
  );
}

    // Check if it's a video
    const video = pageData.videos.find((v) => v.id === card);
    if (video) {
      return (
        <DraggableVideo
          key={card}
          id={card}
          media={video}
          onRemove={handleRemoveMedia}
        />
      );
    }

    // Check if it's a file
    const file = pageData.files.find((f) => f.id === card);
    if (file) {
      return (
        <DraggableFile
          key={card}
          id={card}
          fileItem={file}
          onRemove={handleRemoveMedia}
        />
      );
    }

    // Check if it's a blog section
    const blogSection = pageData.blogSections.find((b) => b.id === card);
    if (blogSection) {
      return (
        <DraggableBlog
          key={card}
          id={card}
          blogSection={blogSection}
          onUpdate={handleUpdateBlogSection}
          onRemove={handleRemoveMedia}
        />
      );
    }

    // Render static components
    switch (card) {
      case "GameLogo":
        return (
          <GameLogo
            key={card}
            id={card}
            pageData={pageData}
            setPageData={setPageData}
            handleChange={handleChange}
            handleSelectMedia={handleSelectMedia}
          />
        );
      case "Purchase":
        return <Purchase key={card} id={card} pageData={pageData} handleChange={handleChange} />;
      case "GameInfo":
        return <GameInfo key={card} id={card} pageData={pageData} handleChange={handleChange} />;
      case "SideBar":
        return <SideBar key={card} id={card} pageData={pageData} setPageData={setPageData} />;
      default:
        return null;
    }
  };

  const uploadFileToS3 = async (file: File): Promise<string> => {
    const res = await axios.get(`${BACKEND_URL}/api/devlogs/getUploadUrl`, {
      params: { fileName: file.name, fileType: file.type },
    });

    const { uploadUrl, key } = res.data;

    const putRes = await axios.put(uploadUrl, file, {
      headers: { "Content-Type": file.type },
    });

    if (putRes.status !== 200) throw new Error("Upload failed");

    const bucket = import.meta.env.VITE_S3_DEVLOGS_BUCKET || "gamesocial-devlogs";
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const finalData: PageData = { ...pageData };

      if (pageData.bgImage?.file) {
        finalData.bgImage = {
          ...pageData.bgImage,
          url: await uploadFileToS3(pageData.bgImage.file),
        };
      }

      if (pageData.gameTitleImage?.file) {
        finalData.gameTitleImage = {
          ...pageData.gameTitleImage,
          url: await uploadFileToS3(pageData.gameTitleImage.file),
        };
      }

      finalData.screenshots = await Promise.all(
        pageData.screenshots.map(async (s) =>
          s.file ? { ...s, url: await uploadFileToS3(s.file) } : s
        )
      );

      finalData.videos = await Promise.all(
        pageData.videos.map(async (v) =>
          v.file ? { ...v, url: await uploadFileToS3(v.file) } : v
        )
      );

      finalData.files = await Promise.all(
        pageData.files.map(async (f) =>
          f.file ? { ...f, url: await uploadFileToS3(f.file) } : f
        )
      );

      console.log("Final Data to submit:", finalData);


      const res = await axios.post(
        `${BACKEND_URL}/api/devlogs`,
        { pageData: finalData, leftColumnCards, rightColumnCards, gradientColor },
        { headers: { "Content-Type": "application/json" } }
      );



      console.log("✅ Devlog saved successfully:", res.data);
      alert("Devlog saved successfully!");
    } catch (err) {
      console.error("❌ Error saving devlog:", err);
      alert("Error saving devlog.");
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="relative min-h-screen">
        {/* Background */}
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center bg-slate-800"
          style={{
            backgroundImage: pageData.bgImage
              ? `linear-gradient(to right, rgba(${gradientColor},1) 0%, rgba(${gradientColor},0.8) 30%, rgba(${gradientColor},0) 70%), url(${pageData.bgImage.url})`
              : `linear-gradient(to right, rgba(${gradientColor},1) 0%, rgba(${gradientColor},0.8) 30%, rgba(${gradientColor},0) 70%)`,
          }}
        />

        {/* Gradient Picker */}
        <div className="absolute top-4 right-4 z-50">
          <label htmlFor="gradient-picker" className="text-sm font-semibold mr-2">
            Choose a shade:
          </label>
          <input
            type="color"
            id="gradient-picker"
            defaultValue="#000000"
            onChange={handleColorChange}
          />
        </div>

        {/* Upload Background */}
        <div className="absolute top-4 left-4 z-50">
          <button
            type="button"
            onClick={() => bgImageRef.current?.click()}
            className="bg-orange-600 text-white px-4 py-2 rounded shadow hover:bg-orange-700"
          >
            Upload Background
          </button>
          <input
            type="file"
            accept="image/*"
            ref={bgImageRef}
            hidden
            onChange={(e) => e.target.files && handleSelectMedia("bgImage", e.target.files[0])}
          />
        </div>

        {/* Media Uploader */}
        <div className="absolute top-4 left-56 z-50 flex gap-2">
          <MediaUploader
            setPageData={setPageData}
            setLeftColumnCards={setLeftColumnCards}
            setRightColumnCards={setRightColumnCards}
          />
        </div>

        <form className="relative z-10 min-h-screen p-4 text-[#ffb347] font-mono" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-6">
              <SortableContext items={leftColumnCards} strategy={rectSortingStrategy}>
                {leftColumnCards.map(renderCard)}
              </SortableContext>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-1 space-y-6">
              <SortableContext items={rightColumnCards} strategy={rectSortingStrategy}>
                {rightColumnCards.map(renderCard)}
              </SortableContext>
            </div>
          </div>

          <div className="text-center mt-6">
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-3 rounded shadow hover:bg-green-700"
            >
              Submit Devlog
            </button>
          </div>
        </form>
      </div>
    </DndContext>
  );
}

export default DevLogs;