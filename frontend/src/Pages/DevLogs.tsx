import React, { useState, useRef } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import type { PageData } from "../types/Devlogs";
import GameLogo from "../components/Devlogs/GameLogo";
import PostTitle from "../components/Devlogs/PostTitle";
import Screenshots from "../components/Devlogs/Screenshots";
import VideoDemo from "../components/Devlogs/VideoDemos";
import Blog from "../components/Devlogs/Blog";
import Files from "../components/Devlogs/Files";
import Purchase from "../components/Devlogs/Purchase";
import SideBar from "../components/Devlogs/SideBar";
import GameInfo from "../components/Devlogs/GameInfo";

function App() {
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
    files: [
      { id: 1, title: "Musketeer [C64] .tap, .d64 + .prg", size: "15 MB" },
      { id: 2, title: "Musketeer C64 Soundtrack (mp3)", size: "41 MB" },
    ],
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
    bgImage: "",
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

  const [rightColumnCards, setRightColumnCards] = useState([
    "GameInfo",
    "SideBar",
  ]);

  const [gradientColor, setGradientColor] = useState("0, 0, 0");
  const bgImageRef = useRef<HTMLInputElement | null>(null);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    setGradientColor(`${r}, ${g}, ${b}`);
  };

  const handleFileChange = (key: keyof PageData, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newUrl = URL.createObjectURL(file);
      setPageData((prev) => ({ ...prev, [key]: newUrl }));
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleChange = (
    field: string,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setPageData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Determine the source and destination lists
    const isSourceLeft = leftColumnCards.includes(active.id);
    const isDestinationLeft = leftColumnCards.includes(over.id);

    // If both source and destination are in the same column
    if (isSourceLeft && isDestinationLeft) {
      setLeftColumnCards((items) => arrayMove(items, items.indexOf(active.id), items.indexOf(over.id)));
    } else if (!isSourceLeft && !isDestinationLeft) {
      setRightColumnCards((items) => arrayMove(items, items.indexOf(active.id), items.indexOf(over.id)));
    } else {
      // Dragging between columns
      if (isSourceLeft) {
        const newLeft = leftColumnCards.filter(item => item !== active.id);
        const newRight = [...rightColumnCards.slice(0, rightColumnCards.indexOf(over.id)), active.id, ...rightColumnCards.slice(rightColumnCards.indexOf(over.id))];
        setLeftColumnCards(newLeft);
        setRightColumnCards(newRight);
      } else {
        const newRight = rightColumnCards.filter(item => item !== active.id);
        const newLeft = [...leftColumnCards.slice(0, leftColumnCards.indexOf(over.id)), active.id, ...leftColumnCards.slice(leftColumnCards.indexOf(over.id))];
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
          <PostTitle
            key={card}
            id={card}
            pageData={pageData}
            handleChange={handleChange}
          />
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
          <VideoDemo
            key={card}
            id={card}
            pageData={pageData}
            setPageData={setPageData}
          />
        );
      case "blog":
        return (
          <Blog
            key={card}
            id={card}
            pageData={pageData}
            handleChange={handleChange}
          />
        );
      case "files":
        return (
          <Files
            key={card}
            id={card}
            pageData={pageData}
            setPageData={setPageData}
          />
        );
      case "Purchase":
        return (
          <Purchase
            key={card}
            id={card}
            pageData={pageData}
            handleChange={handleChange}
          />
        );
      case "GameInfo":
        return (
          <GameInfo
            key={card}
            id={card}
            pageData={pageData}
            handleChange={handleChange}
          />
        );
      case "SideBar":
        return (
          <SideBar
            key={card}
            id={card}
            pageData={pageData}
            setPageData={setPageData}
          />
        );
      default:
        return null;
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
              ? `linear-gradient(to right, rgba(${gradientColor},1) 0%, rgba(${gradientColor},0.8) 30%, rgba(${gradientColor},0) 70%), url(${pageData.bgImage})`
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
            onChange={(e) => handleFileChange("bgImage", e)}
          />
        </div>

        {/* Main Form */}
        <form className="relative z-10 min-h-screen p-4 text-[#ffb347] font-mono">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-6">
              <SortableContext items={leftColumnCards} strategy={rectSortingStrategy}>
                {leftColumnCards.map(renderCard)}
              </SortableContext>
            </div>

            {/* RIGHT COLUMN (Sidebar and GameInfo) */}
            <div className="lg:col-span-1 space-y-6">
              <SortableContext items={rightColumnCards} strategy={rectSortingStrategy}>
                {rightColumnCards.map(renderCard)}
              </SortableContext>
            </div>
          </div>
        </form>
      </div>
    </DndContext>
  );
}

export default App;