import React, { useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface AddPostProps {
  onCancel: () => void;
}

const CreatePost = ({ onCancel }: AddPostProps) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [gameTitle, setGameTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isHeavyGame, setIsHeavyGame] = useState<boolean>(false);
  const [gameFile, setGameFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Client-side validation for file type
      if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
        toast.error("Please upload a valid .zip file!", {
          position: "bottom-right",
        });
        setGameFile(null); // Clear the state
        e.target.value = ''; // Reset the input field
        return;
      }
      setGameFile(file);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gameFile || !coverImage) {
      toast.error("Both game zip and cover image are required!", {
        position: "bottom-right",
      });
      return;
    }

    const uploadingToast = toast.info("Uploading post, please wait...", {
      position: "bottom-right",
      autoClose: false,
      closeButton: false,
      draggable: false,
    });

    const formData = new FormData();
    formData.append("gameZip", gameFile);
    formData.append("coverImage", coverImage);
    formData.append("title", gameTitle);
    formData.append("description", description);
    formData.append("isHeavyGame", String(isHeavyGame));

    try {
      const res = await fetch(`${BACKEND_URL}/api/gameupload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.update(uploadingToast, {
            render: "Game post created successfully! 🎉",
            type: "success",
            isLoading: false,
            autoClose: 5000,
            closeButton: true,
          });
          console.log("Saved post:", data.post);
          onCancel(); // Close the form on success
        } else {
          toast.update(uploadingToast, {
            render: "Failed to create post. 😞",
            type: "error",
            isLoading: false,
            autoClose: 5000,
            closeButton: true,
          });
        }
      } else {
        toast.update(uploadingToast, {
          render: "Failed to create post. Server responded with an error.",
          type: "error",
          isLoading: false,
          autoClose: 5000,
          closeButton: true,
        });
      }
    } catch (err) {
      console.error("Submit error:", err);
      toast.update(uploadingToast, {
        render: "Something went wrong! Please try again.",
        type: "error",
        isLoading: false,
        autoClose: 5000,
        closeButton: true,
      });
    }
  };

  return (
    <div className="min-h-screen text-white flex items-center justify-center py-12">
      <ToastContainer />
      <div className="bg-gray-900 bg-opacity-70 p-8 rounded-lg shadow-xl max-w-2xl w-full backdrop-blur-sm border border-[#3D7A6E]">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 
          transition-colors duration-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-3xl font-bold text-center mb-8 text-white">Create a Game Post</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="gameTitle" className="block text-sm font-medium text-gray-200">
              Game Title
            </label>
            <input
              type="text"
              id="gameTitle"
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              className="mt-1 block w-full px-4 py-2 bg-[#0A1714] border border-[#1F4D44] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3D7A6E] focus:border-[#3D7A6E] text-white"
              placeholder="e.g., The Last of Us Part II"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-200">
              Description
            </label>
            <textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full px-4 py-2 bg-[#0A1714] border border-[#1F4D44] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3D7A6E] focus:border-[#3D7A6E] text-white"
              placeholder="Provide a detailed description of the game, its features, and system requirements."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="gameFile" className="block text-sm font-medium text-gray-200">
                Upload Game File (.zip)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#1F4D44] border-dashed rounded-md cursor-pointer hover:border-[#3D7A6E] transition-colors">
                <input
                  id="gameFile"
                  name="gameFile"
                  type="file"
                  accept=".zip,application/zip"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <label htmlFor="gameFile" className="text-center w-full">
                  {gameFile ? (
                    <p className="text-sm text-[#3D7A6E] truncate">{gameFile.name}</p>
                  ) : (
                    <>
                      <svg
                        className="mx-auto h-12 w-12 text-[#1F4D44]"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-8m32-8l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m-4-4l-4 4m4-4V28M8 32h8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="mt-2 block text-sm font-medium text-[#1F4D44]">
                        Drag and drop or{' '}
                        <span className="text-[#3D7A6E] hover:text-[#589C92]">
                          browse
                        </span>{' '}
                        a .zip file
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="coverImage" className="block text-sm font-medium text-gray-200">
                Upload Cover Image
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#1F4D44] border-dashed rounded-md cursor-pointer hover:border-[#3D7A6E] transition-colors">
                <input
                  id="coverImage"
                  name="coverImage"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImageChange}
                />
                <label htmlFor="coverImage" className="text-center w-full">
                  {coverImage ? (
                    <p className="text-sm text-[#3D7A6E] truncate">{coverImage.name}</p>
                  ) : (
                    <>
                      <svg
                        className="mx-auto h-12 w-12 text-[#1F4D44]"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-8m32-8l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m-4-4l-4 4m4-4V28M8 32h8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="mt-2 block text-sm font-medium text-[#1F4D44]">
                        Drag and drop or{' '}
                        <span className="text-[#3D7A6E] hover:text-[#589C92]">
                          browse
                        </span>{' '}
                        an image
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <span className="text-sm font-medium text-gray-200">Is it a heavy game (over 1 GB)?</span>
            <div
              onClick={() => setIsHeavyGame(!isHeavyGame)}
              className={`relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors duration-300 ${isHeavyGame ? 'bg-[#3D7A6E]' : 'bg-gray-700'}`}
            >
              <div
                className={`absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-300 transform ${isHeavyGame ? 'translate-x-6 bg-white' : 'translate-x-0 bg-gray-400'}`}
              ></div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              className="w-full px-4 py-3 bg-[#3D7A6E] text-white font-semibold rounded-md shadow-lg hover:bg-[#589C92] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3D7A6E]"
            >
              Create Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePost;