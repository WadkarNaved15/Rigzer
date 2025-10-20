// src/components/Home/Profile.tsx
import { CircleUser, Gamepad2, UserRound, Bookmark } from "lucide-react";

interface ProfileCoverProps {
  setProfileOpen: (open: boolean) => void;
}

export default function ProfileCover({ setProfileOpen }: ProfileCoverProps) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Cover Background (Image) */}
      <div className="relative">
        <div
          className="w-full h-16 rounded-xl rounded-br-none bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://fastly.picsum.photos/id/299/800/200.jpg?hmac=xMdRbjiNM_IogJDEgKIJ0GeCxZ8nwOGd5_Wf_ODZ94s')",
          }}
        />
        <div className="absolute -bottom-8 left-2">
          <img
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
            alt="Profile"
            className="cursor-pointer w-16 h-16 rounded-full border-4 border-white dark:border-gray-900"
            onClick={() => setProfileOpen(true)}
          />
        </div>
      </div>

      {/* User Info */}
      <div className="mt-10 px-4">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-md font-bold text-gray-900 dark:text-white">
              John Developer
            </h4>
            <p className="text-gray-500 dark:text-gray-400">
              Game Developer
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex mt-4 items-center justify-center space-x-2">
        {[CircleUser, Gamepad2, UserRound, Bookmark].map((Icon, idx) => (
          <button
            key={idx}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-purple-600/10"
          >
            <Icon className="h-5 w-5 text-gray-600 dark:text-white" />
          </button>
        ))}
      </div>
    </div>
  );
}
