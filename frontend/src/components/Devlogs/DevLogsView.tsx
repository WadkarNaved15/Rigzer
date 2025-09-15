import React from "react";
import type { PageData } from "../../types/Devlogs";
import GameLogo from "./GameLogo";
import PostTitle from "./PostTitle";
import Screenshots from "./Screenshots";
import VideoDemo from "./VideoDemos";
import Blog from "./Blog";
import Files from "./Files";
import Purchase from "./Purchase";
import SideBar from "./SideBar";
import GameInfo from "./GameInfo";

interface DevLogViewProps {
  pageData: PageData;
  leftColumnCards: string[];
  rightColumnCards: string[];
  gradientColor: string;
}

/**
 * Pure read-only renderer for a saved devlog.
 * No drag, upload, or edit logic.
 */
const DevLogView: React.FC<DevLogViewProps> = ({
  pageData={gameTitle: "GAME TITLE",
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
    gameTitleImage: null,},
  leftColumnCards=[
    "GameLogo",
    "PostTitle",
    "screenshots",
    "videos",
    "blog",
    "files",
    "Purchase",
  ],
  rightColumnCards=[
    "GameInfo",
    "SideBar",
  ],
  gradientColor="20,20,20",
}) => {
  const renderCard = (card: string) => {
    switch (card) {
      case "GameLogo":
        return <GameLogo key={card} id={card} pageData={pageData} readOnly />;
      case "PostTitle":
        return <PostTitle key={card} id={card} pageData={pageData} readOnly />;
      case "screenshots":
        return <Screenshots key={card} id={card} pageData={pageData} readOnly />;
      case "videos":
        return <VideoDemo key={card} id={card} pageData={pageData} readOnly />;
      case "blog":
        return <Blog key={card} id={card} pageData={pageData} readOnly />;
      case "files":
        return <Files key={card} id={card} pageData={pageData} readOnly />;
      case "Purchase":
        return <Purchase key={card} id={card} pageData={pageData} readOnly />;
      case "GameInfo":
        return <GameInfo key={card} id={card} pageData={pageData} readOnly />;
      case "SideBar":
        return <SideBar key={card} id={card} pageData={pageData} readOnly />;
      default:
        return null;
    }
  };

  return (
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

      <main className="relative z-10 min-h-screen p-4 text-[#ffb347] font-mono">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-6">
            {leftColumnCards.map(renderCard)}
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-1 space-y-6">
            {rightColumnCards.map(renderCard)}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DevLogView;
