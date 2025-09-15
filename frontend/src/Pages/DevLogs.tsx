import React, { useState, useRef } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import type { PageData, Media, FileItem } from "../types/Devlogs";
import GameLogo from "../components/Devlogs/GameLogo";
import PostTitle from "../components/Devlogs/PostTitle";
import Screenshots from "../components/Devlogs/Screenshots";
import VideoDemo from "../components/Devlogs/VideoDemos";
import Blog from "../components/Devlogs/Blog";
import Files from "../components/Devlogs/Files";
import Purchase from "../components/Devlogs/Purchase";
import SideBar from "../components/Devlogs/SideBar";
import GameInfo from "../components/Devlogs/GameInfo";
import axios from "axios";

function DevLogs() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const [pageData, setPageData] = useState<PageData>({
    gameTitle: "GAME TITLE",
    postTitle: "Post Title",
    postTag: "Devlog",
    postDate: "1 day ago",
    author: "Author Name",
    italicQuote: "Bonjour mes amis!",
    bodyParagraph1:
      "Some free bonus extra content has now been added to the Musketeer download bundle...",
    bodyParagraph2:
      "The complete soundtrack from the game is also available to enjoy...",
    bodyParagraph3:
      "Also, some good news for people interested in obtaining a physical edition...",
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
  });

  const [leftColumnCards, setLeftColumnCards] = useState([
    "GameLogo",
    "PostTitle",
    "screenshots",
    "videos",
    "blog",
    "files",
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

  // Handle single Media file selection
  const handleSelectMedia = (key: keyof PageData, file: File) => {
    const media: Media = { file, url: URL.createObjectURL(file), type: file.type };
    setPageData((prev) => ({
      ...prev,
      [key]: media,
    }));
  };

  // Handle multiple Media files
  const handleSelectMultipleMedia = (key: keyof PageData, files: FileList) => {
    const newMedia: Media[] = Array.from(files).map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type,
    }));
    setPageData((prev) => ({
      ...prev,
      [key]: [...(prev[key] as Media[]), ...newMedia],
    }));
  };

  const handleChange = (
    field: string,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setPageData((prev) => ({ ...prev, [field]: e.target.value }));
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
        const newRight = [
          ...rightColumnCards.slice(0, rightColumnCards.indexOf(over.id)),
          active.id,
          ...rightColumnCards.slice(rightColumnCards.indexOf(over.id)),
        ];
        setLeftColumnCards(newLeft);
        setRightColumnCards(newRight);
      } else {
        const newRight = rightColumnCards.filter((item) => item !== active.id);
        const newLeft = [
          ...leftColumnCards.slice(0, leftColumnCards.indexOf(over.id)),
          active.id,
          ...leftColumnCards.slice(leftColumnCards.indexOf(over.id)),
        ];
        setRightColumnCards(newRight);
        setLeftColumnCards(newLeft);
      }
    }
  };

  const renderCard = (card: string) => {
    switch (card) {
      case "GameLogo":
        return (
          <GameLogo
            key={card}
            id={card}
            pageData={pageData}
            setPageData={setPageData}
            handleChange={handleChange}
          />
        );
      case "PostTitle":
        return (
          <PostTitle key={card} id={card} pageData={pageData} handleChange={handleChange} />
        );
      case "screenshots":
        return (
          <Screenshots
            key={card}
            id={card}
            pageData={pageData}
            setPageData={setPageData}
          />
        );
      case "videos":
        return (
          <VideoDemo key={card} id={card} pageData={pageData} setPageData={setPageData} />
        );
      case "blog":
        return <Blog key={card} id={card} pageData={pageData} handleChange={handleChange} />;
      case "files":
        return <Files key={card} id={card} pageData={pageData} setPageData={setPageData} />;
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
  // Request signed URL
  const res = await axios.get(`${BACKEND_URL}/api/devlogs/getUploadUrl`, {
    params: { fileName: file.name, fileType: file.type },
  });

  const { uploadUrl, key } = res.data;

  // Upload the file
      const putRes = await axios.put(uploadUrl, file, {
      headers: {
        "Content-Type": file.type,
      },
    });
    console.log("putRes", putRes);

  if (putRes.status!=200) throw new Error("Upload failed");

  // Return the public URL (replace with CloudFront if available)
  const bucket = import.meta.env.VITE_S3_DEVLOGS_BUCKET || "gamesocial-devlogs";
  return `https://${bucket}.s3.amazonaws.com/${key}`;
};


const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    const finalData: PageData = { ...pageData };

    // 1️⃣ Upload bgImage
    if (pageData.bgImage?.file) {
      finalData.bgImage = {
        ...pageData.bgImage,
        url: await uploadFileToS3(pageData.bgImage.file),
      };
    }

    // 2️⃣ Upload gameTitleImage
    if (pageData.gameTitleImage?.file) {
      finalData.gameTitleImage = {
        ...pageData.gameTitleImage,
        url: await uploadFileToS3(pageData.gameTitleImage.file),
      };
    }

    // 3️⃣ Upload screenshots
    if (pageData.screenshots.length) {
      finalData.screenshots = await Promise.all(
        pageData.screenshots.map(async (s) => {
          if (s.file) {
            return { ...s, url: await uploadFileToS3(s.file) };
          }
          return s;
        })
      );
    }

    // 4️⃣ Upload videos
    if (pageData.videos.length) {
      finalData.videos = await Promise.all(
        pageData.videos.map(async (v) => {
          if (v.file) {
            return { ...v, url: await uploadFileToS3(v.file) };
          }
          return v;
        })
      );
    }

    // 5️⃣ Upload files (PDFs, zips, etc.)
    if (pageData.files.length) {
      finalData.files = await Promise.all(
        pageData.files.map(async (f) => {
          if (f.file) {
            return { ...f, url: await uploadFileToS3(f.file) };
          }
          return f;
        })
      );
    }

    // 6️⃣ Save devlog
    const res = await axios.post(
      `${BACKEND_URL}/api/devlogs`,
      {
        pageData: finalData,
        leftColumnCards,
        rightColumnCards,
        gradientColor,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("Devlog saved successfully!", res.data);
  } catch (err) {
    console.error(err);
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
          <input type="color" id="gradient-picker" defaultValue="#000000" onChange={handleColorChange} />
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
