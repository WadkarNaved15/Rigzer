// src/components/Home/Profile.tsx
import { CircleUser, Gamepad2, UserRound, Bookmark } from "lucide-react";

interface ProfileCoverProps {
  setProfileOpen: (open: boolean) => void;
}

export default function ProfileCover({ setProfileOpen }: ProfileCoverProps) {
  return (
    <div className="max-w-3xl mx-auto ">
      {/* MAIN CARD */}
      <div className="relative bg-[#1e1e1e] shadow-2xl rounded-t-[0.5rem] overflow-hidden">
        
        {/* Inset border using ring (fixes green line issue) */}
        <div className="pointer-events-none absolute inset-0 rounded-t-[0.7rem]" />

        {/* Cover Background */}
        <div className="relative">
          <div
            className="w-full h-16 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://fastly.picsum.photos/id/299/800/200.jpg?hmac=xMdRbjiNM_IogJDEgKIJ0GeCxZ8nwOGd5_Wf_ODZ94s')",
            }}
          />

          {/* Profile Image */}
          <div className="absolute -bottom-8 left-4">
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
              alt="Profile"
              className="cursor-pointer w-16 h-16 rounded-full"
              onClick={() => setProfileOpen(true)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="mt-10 px-4">
          <h4 className="text-md font-bold text-white">John Developer</h4>
          <p className="text-gray-400 text-sm">Game Developer</p>
        </div>

        {/* Nav Buttons */}
        <div className="flex mt-4 pb-4 items-center justify-center space-x-2">
          {[CircleUser, Gamepad2, UserRound, Bookmark].map((Icon, idx) => (
            <button
              key={idx}
              className="p-2 rounded-full hover:bg-white/10 transition"
            >
              <Icon className="h-5 w-5 text-white" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
