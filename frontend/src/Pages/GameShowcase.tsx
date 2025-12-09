import React, { useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import GameLogoCard from "../components/Home/Gamelogo";
import SortableCard from "../components/Home/SortableCard";
import { Heart, Twitter, Facebook } from "lucide-react";
import AutoWidthInput from "../components/Devlogs/AutoWidthInput";
import AutoResizeTextarea from "../components/Devlogs/AutoResizeTextarea";

const SortablePage: React.FC = () => {
  const [cards, setCards] = useState([
    "logo",
    "info",
    "postHeader",
    "screenshots",
    "videos",
    "blog",
    "files",
  ]);

  const screenshot1Ref = useRef<HTMLInputElement>(null);
  const screenshot2Ref = useRef<HTMLInputElement>(null);
  const [pageData, setPageData] = useState<{
  gameTitle: string;
  gameTitleImage: null;
  gameInfoTitle: string;
  gameInfoDescription: string;
  postTitle: string;
  author: string;
  screenshots: string[];
  videos: string []; // Change this to string[] if you want to allow videos
  italicQuote: string;
  storeLink: string;
  closingQuote: string;
  signature: string;
  files: { id: number; title: string; }[];
}>({
  gameTitle: "Game Name",
  gameTitleImage: null,
  gameInfoTitle: "Game Info Title",
  gameInfoDescription: "Game description goes here...",
  postTitle: "This is a Post Title",
  author: "Author Name",
  screenshots: [], // Initialize with an empty array
  videos: [], // Initialize with an empty array
  italicQuote: "",
  storeLink: "",
  closingQuote: "",
  signature: "",
  files: [
    { id: 1, title: "ReadMe.txt" },
    { id: 2, title: "PatchNotes.pdf" },
  ],
});
  

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleChange = (
    field: string,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setPageData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setCards((items) => {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cards} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-6">
          {cards.map((id) => {
            if (id === "logo") {
              return (
                <div key={id} className="col-span-2">
                  <GameLogoCard
                    id={id}
                    pageData={pageData}
                    setPageData={setPageData}
                    handleChange={handleChange}
                  />
                </div>
              );
            }

            if (id === "info") {
              return (
                <SortableCard key={id} id={id}>
                  <div className="space-y-6">
                    <div className="bg-slate-700 rounded-lg p-6">
                      <input
                        type="text"
                        className="text-xl font-bold text-white bg-transparent outline-none w-full"
                        value={pageData.gameInfoTitle}
                        onChange={(e) => handleChange("gameInfoTitle", e)}
                      />
                      <textarea
                        className="text-slate-300 bg-transparent outline-none w-full mt-2"
                        value={pageData.gameInfoDescription}
                        onChange={(e) =>
                          handleChange("gameInfoDescription", e)
                        }
                      />
                    </div>
                  </div>
                </SortableCard>
              );
            }

            if (id === "postHeader") {
              return (
                <div key={id} className="col-span-2">
                  <SortableCard id={id}>
                    <div className="bg-slate-800 rounded-lg p-6">
                      <div className="mt-2 mb-6">
                        <input
                          type="text"
                          className="text-3xl font-bold text-white mb-4 bg-transparent outline-none w-full"
                          value={pageData.postTitle}
                          onChange={(e) => handleChange("postTitle", e)}
                        />
                        <div className="flex items-center space-x-4 text-slate-400 mb-4">
                          <AutoWidthInput
                            value={pageData.gameInfoTitle}
                            spanClassName="absolute invisible whitespace-pre font-bold text-orange-400"
                            className="text-orange-400 bg-transparent outline-none font-bold"
                            onChange={(e) => handleChange("gameInfoTitle", e)}
                          />
                          <span>»</span>
                          <p className="bg-transparent outline-none">Devlog</p>
                        </div>
                        <div className="flex items-center space-x-6 mb-4">
                          <button
                            type="button"
                            className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded"
                          >
                            <Heart size={16} />
                            <span>Like</span>
                          </button>
                          <p className="text-slate-400 bg-transparent outline-none">
                            1 day ago
                          </p>
                          <span className="text-slate-400">by</span>
                          <AutoWidthInput
                            value={pageData.author}
                            spanClassName="absolute invisible whitespace-pre font-bold text-orange-400"
                            className="text-orange-400 bg-transparent outline-none font-bold"
                            onChange={(e) => handleChange("author", e)}
                          />
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-slate-400">
                            Share this post:
                          </span>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-white"
                          >
                            <Twitter size={20} />
                          </button>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-white"
                          >
                            <Facebook size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </SortableCard>
                </div>
              );
            }

            if (id === "screenshots") {
              return (
                <div key={id} className="col-span-2">
                  <SortableCard id={id}>
                    <div className="bg-slate-700 rounded-lg p-6">
                      <div className="mt-8">
                        <h3 className="text-2xl font-bold text-white mb-4">
                          Screenshots
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {pageData.screenshots.map((s, index) => (
                            <div key={index} className="relative">
                              <img
                                src={s}
                                alt={`Screenshot ${index + 1}`}
                                className="rounded-lg shadow-md w-full h-48 object-contain"
                              />
                              <button
                                type="button"
                                className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs"
                                onClick={() => {
                                  setPageData((prev) => ({
                                    ...prev,
                                    screenshots: prev.screenshots.filter(
                                      (_, i) => i !== index
                                    ),
                                  }));
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4">
                          <button
                            type="button"
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
                            onClick={() => screenshot1Ref.current?.click()}
                          >
                            Upload Screenshot
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            ref={screenshot1Ref}
                            hidden
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              const newUrls = files.map((file) =>
                                URL.createObjectURL(file)
                              );
                              setPageData((prev) => ({
                                ...prev,
                                screenshots: [
                                  ...prev.screenshots,
                                  ...newUrls,
                                ],
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </SortableCard>
                </div>
              );
            }

            if (id === "videos") {
              return (
                <div key={id} className="col-span-2">
                  <SortableCard id={id}>
                    <div className="bg-slate-700 rounded-lg p-6">
                      <div className="mt-8">
                        <h3 className="text-2xl font-bold text-white mb-4">
                          Video Demos
                        </h3>
                        <div className="grid grid-cols-1 gap-6">
                          {pageData.videos.map((v, index) => (
                            <div key={index} className="relative">
                              <video
                                src={v}
                                controls
                                className="rounded-lg shadow-md w-full max-h-96"
                              />
                              <button
                                type="button"
                                className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs"
                                onClick={() => {
                                  setPageData((prev) => ({
                                    ...prev,
                                    videos: prev.videos.filter(
                                      (_, i) => i !== index
                                    ),
                                  }));
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4">
                          <button
                            type="button"
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
                            onClick={() => screenshot2Ref.current?.click()}
                          >
                            Upload Video
                          </button>
                          <input
                            type="file"
                            accept="video/*"
                            ref={screenshot2Ref}
                            hidden
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              const newUrls = files.map((file) =>
                                URL.createObjectURL(file)
                              );
                              setPageData((prev) => ({
                                ...prev,
                                videos: [...prev.videos, ...newUrls],
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </SortableCard>
                </div>
              );
            }

            if (id === "blog") {
              return (
                <div key={id} className="col-span-2">
                  <SortableCard id={id}>
                    <div className="bg-slate-800 rounded-lg p-6">
                      <div className="prose prose-invert max-w-none mt-4 mb-8 space-y-4">
                        <AutoResizeTextarea
                          value={pageData.italicQuote}
                          onChange={(e) => handleChange("italicQuote", e)}
                        />
                        <input
                          type="url"
                          className="text-orange-400 underline bg-transparent outline-none w-full"
                          value={pageData.storeLink}
                          onChange={(e) => handleChange("storeLink", e)}
                        />
                        <input
                          type="text"
                          className="text-slate-300 bg-transparent outline-none w-full"
                          value={pageData.closingQuote}
                          onChange={(e) => handleChange("closingQuote", e)}
                        />
                        <input
                          type="text"
                          className="text-slate-300 bg-transparent outline-none w-full"
                          value={pageData.signature}
                          onChange={(e) => handleChange("signature", e)}
                        />
                      </div>
                    </div>
                  </SortableCard>
                </div>
              );
            }

            if (id === "files") {
              return (
                <div key={id} className="col-span-2">
                  <SortableCard id={id}>
                    <div className="bg-slate-800 rounded-lg p-6">
                      <h3 className="text-2xl font-bold text-white mb-6">
                        Files
                      </h3>
                      <div className="space-y-4">
                        {pageData.files.map((file, index) => (
                          <div
                            key={file.id}
                            className="bg-slate-700 rounded-lg p-4 flex justify-between"
                          >
                            <AutoWidthInput
                              value={file.title}
                              spanClassName="absolute invisible whitespace-pre font-bold"
                              className="bg-transparent outline-none font-bold text-gray-400"
                              onChange={(e) => {
                                const newFiles = [...pageData.files];
                                newFiles[index].title = e.target.value;
                                setPageData({
                                  ...pageData,
                                  files: newFiles,
                                });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </SortableCard>
                </div>
              );
            }

            return (
              <SortableCard key={id} id={id}>
                <div className="bg-gray-300 w-full h-24 flex items-center justify-center rounded shadow">
                  {id}
                </div>
              </SortableCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default SortablePage;
