// src/components/Home/Profile.tsx
import { CircleUser, Gamepad2, UserRound, Bookmark } from "lucide-react";

interface ProfileCoverProps {
  setProfileOpen: (open: boolean) => void;
}

export default function ProfileCover({ setProfileOpen }: ProfileCoverProps) {
  const cardBg = '#191919';
  const navItems = [
    { 
      icon: CircleUser, 
      label: "Profile", 
      action: () => setProfileOpen(true) 
    },
    { 
      icon: Gamepad2, 
      label: "Games", 
      action: () => console.log("Games clicked") 
    },
    { 
      icon: UserRound, 
      label: "Friends", 
      action: () => console.log("Friends clicked") 
    },
    { 
      icon: Bookmark, 
      label: "Saved", 
      action: () => console.log("Saved clicked") 
    },
  ];
  return (
    <div className="max-w-3xl mx-auto ">
      {/* MAIN CARD - Using backdrop-blur, exact border, and background from example */}
      <div 
        className="relative backdrop-blur-sm border border-white/5 rounded-t-[0.5rem] overflow-hidden shadow-xl"
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
          
          {/* UPDATED: Applied the exact 4-step gradient from your latest example */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent 0%, rgba(25, 25, 25, 0.2) 30%, rgba(25, 25, 25, 0.7) 60%, ${cardBg} 100%)`
            }}
          />

          {/* Profile Image */}
          <div className="absolute -bottom-8 left-4">
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
              alt="Profile"
              className="w-16 h-16 rounded-full border-4 shadow-2xl object-cover"
              style={{
                borderColor: cardBg // Matches the new background color exactly
              }}
            />
          </div>
        </div>

        {/* Content - Maintained height and padding structure */}
        <div className="mt-10 px-4">
          <h4 className="text-md font-bold text-gray-100">John Developer</h4>
          <p className="text-gray-500 text-sm">Game Developer</p>
        </div>

        {/* Nav Buttons */}
        <div className="flex mt-4 pb-4 items-center justify-center space-x-2">
          {navItems.map((item, idx) => (
            <button
              key={idx}
              onClick={item.action}
              title={item.label} // Basic tooltip on hover
              className="p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 group"
            >
              <item.icon className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}