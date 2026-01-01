import { FaUpload } from "react-icons/fa";

export default function UploadBox({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className="w-full max-w-3xl mx-auto mt-4">
<button
  onClick={onUploadClick}
  className="min-w-full h-10 px-4 flex items-center justify-center 
  rounded-lg border-[3.5px] border-[#1e1e1e]
  text-white text-sm font-medium tracking-wide 
  hover:opacity-90 transition"
>
        <FaUpload className="mr-2" />
        Upload
      </button>
    </div>
  );
}

