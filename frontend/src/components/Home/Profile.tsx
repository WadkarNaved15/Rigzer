// src/components/Home/Profile.tsx
import { CircleUser, Gamepad2, UserRound, Bookmark } from "lucide-react";

interface ProfileCoverProps {
  setProfileOpen: (open: boolean) => void;
}

export default function ProfileCover({ setProfileOpen }: ProfileCoverProps) {
  const cardBg = '#191919';

  return (
    <div className="max-w-3xl mx-auto ">
      {/* MAIN CARD */}
      <div 
        className="relative shadow-2xl rounded-t-[0.5rem] overflow-hidden border border-white/5"
        style={{ backgroundColor: cardBg }}
      >
        
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
          {/* Reference Styling: Banner Gradient */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent 0%, rgba(25, 25, 25, 0.3) 40%, rgba(25, 25, 25, 0.95) 100%)`
            }}
          />

          {/* Profile Image */}
          <div className="absolute -bottom-8 left-4">
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
              alt="Profile"
              className="cursor-pointer w-16 h-16 rounded-full border-4"
              style={{
                borderColor: cardBg // Reference Styling: Matches card background
              }}
              onClick={() => setProfileOpen(true)}
            />
          </div>
        </div>

        {/* Content with Reference Styling Gradient */}
        <div 
          className="mt-0 px-4 pt-10"
          style={{
            background: `linear-gradient(180deg, rgba(78, 205, 196, 0.08) 0%, rgba(25, 25, 25, 0.98) 20%, ${cardBg} 100%)`
          }}
        >
          <h4 className="text-md font-bold text-gray-100">John Developer</h4>
          <p className="text-gray-500 text-sm">Game Developer</p>

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
    </div>
  );
}