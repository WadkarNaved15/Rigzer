import type { LibraryGame } from "./scenes";

/* -------------------------------------------------------------------------- */
/*  Library                                                                   */
/* -------------------------------------------------------------------------- */

export const LIBRARY_GAMES: LibraryGame[] = [
  { id: "it-takes-two", title: "It Takes Two", genre: "Co-op adventure", hoursPlayed: 0, theme: "forest", scene: "knight", wide: true },
  { id: "sekiro", title: "Sekiro: Shadows Die Twice", genre: "Action adventure", hoursPlayed: 90, theme: "ember", scene: "temple", tall: true },
  { id: "nfs-heat", title: "Need for Speed Heat", genre: "Racing", hoursPlayed: 0, theme: "rose", scene: "racer" },
  { id: "hades", title: "Hades", genre: "Roguelike", hoursPlayed: 0, theme: "ember", scene: "hex" },
  { id: "warhammer-3", title: "Total War: Warhammer III", genre: "Grand strategy", hoursPlayed: 54, theme: "violet", scene: "temple" },
  { id: "stardew", title: "Stardew Valley", genre: "Farming sim", hoursPlayed: 120, theme: "lime", scene: "field", wide: true },
];

/* -------------------------------------------------------------------------- */
/*  Detail page data                                                          */
/*  NOTE: sample content. Swap for your API / CMS when it exists. Anything    */
/*  without a credit is left undefined on purpose rather than invented.       */
/* -------------------------------------------------------------------------- */

export interface Requirement {
  os: string;
  cpu: string;
  gpu: string;
  ram: string;
  storage: string;
}

export interface MediaItem {
  id: string;
  caption: string;
  kind: "screenshot" | "video";
  /** [zoom, originX %, originY %] - crops different parts of the scene art */
  crop: [number, number, number];
}

export interface TeamRole {
  role: string;
  name?: string;
}

export interface Studio {
  name: string;
  initials: string;
  verified: boolean;
  location: string;
  founded: string;
  bio: string;
  team: TeamRole[];
  links: { site?: string; x?: string; discord?: string };
  titles: { title: string; year: number; genre: string }[];
}

export interface ActivityItem {
  user: string;
  kind: "review" | "screenshot" | "guide" | "clip";
  text: string;
  ago: string;
}

export interface GameDetailData {
  tagline: string;
  about: string[];
  genres: string[];
  esrb: { rating: string; descriptors: string };
  year: number;
  releaseDate: string;
  userRating: number; // % positive
  reviewCount: string;
  metascore: number;
  storageGb: number;
  features: { title: string; body: string }[];
  requirements: { minimum: Requirement; recommended: Requirement };
  media: MediaItem[];
  studio: Studio;
  details: [string, string][];
  activity: { online: string; items: ActivityItem[] };
  trailerSeconds: number;
  /** When set, the trailer modal plays this file instead of the placeholder reel. */
  trailerUrl?: string;
}

const CROPS: MediaItem["crop"][] = [
  [1, 50, 50],
  [1.8, 76, 42],
  [2.4, 72, 82],
  [1.6, 18, 62],
  [2.8, 76, 40],
  [1.4, 30, 28],
];

function media(id: string, captions: string[]): MediaItem[] {
  return captions.map((caption, i) => ({
    id: `${id}-${i + 1}`,
    caption,
    kind: i === 0 ? "video" : "screenshot",
    crop: CROPS[i % CROPS.length],
  }));
}

export const GAME_DETAILS: Record<string, GameDetailData> = {
  sekiro: {
    tagline: "One arm, one blade, and a very small window to get the parry right.",
    about: [
      "Sengoku-era Japan is coming apart. You play Wolf, a shinobi who loses an arm and his honor in the same night, then gets handed a prosthetic tool and a second chance to protect the young lord he failed.",
      "Combat is built around posture rather than health bars. You win by reading rhythm, deflecting at the last moment and breaking an opponent's stance, and stealth, grappling and verticality give you real alternatives to a straight duel.",
    ],
    genres: ["Action", "Adventure", "Souls-like"],
    esrb: { rating: "M", descriptors: "Blood and gore, intense violence" },
    year: 2019,
    releaseDate: "22 Mar 2019",
    userRating: 94,
    reviewCount: "212K",
    metascore: 90,
    storageGb: 15,
    features: [
      { title: "Posture-based combat", body: "Fights are decided by breaking stance. Deflect, counter, then finish." },
      { title: "Grapple and stealth", body: "Rooftops and tall grass let you open a fight on your own terms." },
      { title: "Prosthetic tools", body: "Swap in shuriken, firecrackers or an umbrella to bend a fight your way." },
      { title: "Death with consequences", body: "Resurrect once mid-fight, but each death has a cost for the world around you." },
    ],
    requirements: {
      minimum: { os: "Windows 7 64-bit", cpu: "Intel Core i3-2100 / AMD FX-6300", gpu: "NVIDIA GTX 760 / AMD Radeon HD 7950", ram: "4 GB", storage: "25 GB" },
      recommended: { os: "Windows 10 64-bit", cpu: "Intel Core i5-2500K / AMD Ryzen 3 1200", gpu: "NVIDIA GTX 970 / AMD Radeon RX 570", ram: "8 GB", storage: "25 GB" },
    },
    media: media("sekiro", ["Launch trailer", "Ashina rooftops at dusk", "Duel at the bridge", "Temple approach", "Fire and ash", "Boss threshold"]),
    studio: {
      name: "FromSoftware",
      initials: "FS",
      verified: true,
      location: "Tokyo, Japan",
      founded: "1986",
      bio: "Known for dense, unforgiving action RPGs built around world design that rewards patience and observation.",
      team: [
        { role: "Game Director", name: "Hidetaka Miyazaki" },
        { role: "Lead Composer", name: "Yuka Kitamura" },
        { role: "Art Director", name: "Masanori Waragai" },
      ],
      links: { site: "https://www.fromsoftware.jp", x: "https://x.com/fromsoftware_pr" },
      titles: [
        { title: "Elden Ring", year: 2022, genre: "Action RPG" },
        { title: "Dark Souls III", year: 2016, genre: "Action RPG" },
        { title: "Bloodborne", year: 2015, genre: "Action RPG" },
      ],
    },
    details: [
      ["Developer", "FromSoftware"],
      ["Publisher", "Activision"],
      ["Released", "22 Mar 2019"],
      ["Players", "Single-player"],
      ["Platforms", "Windows"],
      ["Languages", "English, Japanese + 11 more"],
    ],
    activity: {
      online: "3,418",
      items: [
        { user: "ghostwolf", kind: "guide", text: "Posted a guide: beating the Guardian Ape without the Divine Dragon cheese", ago: "2h" },
        { user: "kiri_n", kind: "clip", text: "Shared a clip: no-damage Genichiro", ago: "5h" },
        { user: "asha.v", kind: "review", text: "Wrote a review: \"Hard, but never unfair.\"", ago: "1d" },
      ],
    },
    trailerSeconds: 92,
  },

  "it-takes-two": {
    tagline: "A couple, a cuckoo clock and a game that refuses to let you play alone.",
    about: [
      "Cody and May are headed for divorce when a spell shrinks them into dolls and drops them into the family shed. The only way back is to finish a book of increasingly odd challenges together.",
      "Every level hands the two players different mechanics that only make sense in combination. It is strictly two-player, either on one machine or online, and it rarely repeats an idea twice.",
    ],
    genres: ["Co-op", "Adventure", "Platformer"],
    esrb: { rating: "T", descriptors: "Fantasy violence, mild language" },
    year: 2021,
    releaseDate: "26 Mar 2021",
    userRating: 97,
    reviewCount: "168K",
    metascore: 88,
    storageGb: 50,
    features: [
      { title: "Built for exactly two", body: "No single-player mode and no bots. Both roles matter in every scene." },
      { title: "Split-screen first", body: "Couch or online, with a Friend's Pass so only one of you has to own it." },
      { title: "Constantly changing rules", body: "Time manipulation, magnets, gravity boots. Few mechanics outlast their level." },
      { title: "Mini-games everywhere", body: "Side games hide in nearly every room and are worth the detour." },
    ],
    requirements: {
      minimum: { os: "Windows 8.1 64-bit", cpu: "Intel Core i3-2100T / AMD FX 6100", gpu: "NVIDIA GTX 660 / AMD Radeon R7 260", ram: "8 GB", storage: "50 GB" },
      recommended: { os: "Windows 10 64-bit", cpu: "Intel Core i5-3570K / AMD FX 8350", gpu: "NVIDIA GTX 1060 / AMD Radeon RX 480", ram: "8 GB", storage: "50 GB" },
    },
    media: media("it-takes-two", ["Gameplay overview", "The garden shed", "Clock tower puzzle", "Snow globe", "Tree house", "Finale"]),
    studio: {
      name: "Hazelight Studios",
      initials: "HZ",
      verified: true,
      location: "Stockholm, Sweden",
      founded: "2014",
      bio: "A small studio that only makes cooperative games and designs every level around two people sharing a screen.",
      team: [
        { role: "Game Director", name: "Josef Fares" },
        { role: "Lead Composer", name: "Gustaf Grefberg" },
        { role: "Art Director" },
      ],
      links: { site: "https://www.hazelight.se", x: "https://x.com/hazelightstudios" },
      titles: [
        { title: "A Way Out", year: 2018, genre: "Co-op adventure" },
        { title: "Split Fiction", year: 2025, genre: "Co-op adventure" },
      ],
    },
    details: [
      ["Developer", "Hazelight Studios"],
      ["Publisher", "Electronic Arts"],
      ["Released", "26 Mar 2021"],
      ["Players", "2-player co-op"],
      ["Platforms", "Windows"],
      ["Languages", "English, Swedish + 12 more"],
    ],
    activity: {
      online: "1,206",
      items: [
        { user: "marlowe", kind: "screenshot", text: "Posted a screenshot from the snow globe level", ago: "1h" },
        { user: "dev.k", kind: "review", text: "Wrote a review: \"Best two hours I've spent with my brother.\"", ago: "6h" },
        { user: "tuna_bread", kind: "guide", text: "Posted a guide: every mini-game and where to find it", ago: "2d" },
      ],
    },
    trailerSeconds: 74,
  },

  hades: {
    tagline: "Dying is the whole point. Getting a little further each time is the game.",
    about: [
      "Zagreus, son of Hades, wants out of the Underworld, and his family would very much like him to stay. Each escape attempt is a fast run through procedurally arranged chambers, ending, usually, back at the house.",
      "Between runs you talk to everyone, upgrade your weapons and build a new loadout from boons offered by the Olympian gods. The story moves forward on failure, which is the neat trick that makes the loop feel earned.",
    ],
    genres: ["Roguelike", "Action", "Indie"],
    esrb: { rating: "T", descriptors: "Blood, fantasy violence, mild language" },
    year: 2020,
    releaseDate: "17 Sep 2020",
    userRating: 98,
    reviewCount: "224K",
    metascore: 93,
    storageGb: 15,
    features: [
      { title: "Six infernal weapons", body: "Each has hidden aspects that change how it plays, not just its numbers." },
      { title: "Boon system", body: "Combine gifts from different gods into builds the designers did not plan." },
      { title: "A story that lives in the loop", body: "Characters remember what you did and react the next time you die." },
      { title: "Heat and Pact of Punishment", body: "Dial up the difficulty once the first escape feels routine." },
    ],
    requirements: {
      minimum: { os: "Windows 7 SP1", cpu: "Dual Core 2.4 GHz", gpu: "1 GB VRAM, DirectX 10+", ram: "4 GB", storage: "15 GB" },
      recommended: { os: "Windows 10", cpu: "Quad Core 3.0 GHz", gpu: "2 GB VRAM, DirectX 11+", ram: "8 GB", storage: "15 GB" },
    },
    media: media("hades", ["Gameplay trailer", "Tartarus, first chamber", "Boon selection", "Styx crossing", "Elysium arena", "House of Hades"]),
    studio: {
      name: "Supergiant Games",
      initials: "SG",
      verified: true,
      location: "San Francisco, USA",
      founded: "2009",
      bio: "An independent studio with a steady track record of hand-painted worlds, reactive soundtracks and narrators who talk back.",
      team: [
        { role: "Creative Director", name: "Greg Kasavin" },
        { role: "Lead Composer", name: "Darren Korb" },
        { role: "Art Director", name: "Jen Zee" },
      ],
      links: { site: "https://www.supergiantgames.com", x: "https://x.com/supergiantgames" },
      titles: [
        { title: "Bastion", year: 2011, genre: "Action RPG" },
        { title: "Transistor", year: 2014, genre: "Action RPG" },
        { title: "Pyre", year: 2017, genre: "Sports RPG" },
      ],
    },
    details: [
      ["Developer", "Supergiant Games"],
      ["Publisher", "Supergiant Games"],
      ["Released", "17 Sep 2020"],
      ["Players", "Single-player"],
      ["Platforms", "Windows"],
      ["Languages", "English, French + 8 more"],
    ],
    activity: {
      online: "5,102",
      items: [
        { user: "zag_main", kind: "clip", text: "Shared a clip: 32-heat run with the Aspect of Hestia", ago: "3h" },
        { user: "nyx.eve", kind: "guide", text: "Posted a guide: Hermes dash builds that actually scale", ago: "9h" },
        { user: "orfeo", kind: "review", text: "Wrote a review: \"The only game that made losing fun.\"", ago: "1d" },
      ],
    },
    trailerSeconds: 83,
  },

  stardew: {
    tagline: "Inherit a plot of weeds, stay for the town.",
    about: [
      "You leave office life behind for your late grandfather's farm in Stardew Valley. The land is overgrown, the money is tight and the town has opinions about the newcomer.",
      "Days are short and the options are many: crops, animals, fishing, mining, crafting, or just being a good neighbor. It is a game about seasons, small goals and slowly watching a place come together.",
    ],
    genres: ["Farming sim", "RPG", "Indie"],
    esrb: { rating: "E10+", descriptors: "Fantasy violence, alcohol reference, mild blood" },
    year: 2016,
    releaseDate: "26 Feb 2016",
    userRating: 98,
    reviewCount: "620K",
    metascore: 89,
    storageGb: 1,
    features: [
      { title: "Four seasons, one year at a time", body: "Plan crops around the calendar and festivals that actually matter." },
      { title: "Relationships with 30+ villagers", body: "Gifts, events and heart scenes. Marriage is optional, kindness is not." },
      { title: "Mines, caves and monsters", body: "Descend for ore and gems when the farm gets quiet." },
      { title: "Co-op for up to four", body: "Share a farm online or split-screen and divide the chores." },
    ],
    requirements: {
      minimum: { os: "Windows Vista or newer", cpu: "2 GHz", gpu: "256 MB video memory", ram: "2 GB", storage: "500 MB" },
      recommended: { os: "Windows 10", cpu: "Dual Core 2.5 GHz", gpu: "512 MB video memory", ram: "4 GB", storage: "1 GB" },
    },
    media: media("stardew", ["Farm overview", "Spring planting", "The old mine", "Summer festival", "Beach at dawn", "Winter harvest"]),
    studio: {
      name: "ConcernedApe",
      initials: "CA",
      verified: true,
      location: "Seattle, USA",
      founded: "2012",
      bio: "A one-person studio. Design, code, art and music all come from the same desk.",
      team: [
        { role: "Game Director", name: "Eric Barone" },
        { role: "Lead Composer", name: "Eric Barone" },
        { role: "Art Director", name: "Eric Barone" },
      ],
      links: { site: "https://www.stardewvalley.net", x: "https://x.com/concernedape" },
      titles: [{ title: "Haunted Chocolatier", year: 2027, genre: "Action RPG" }],
    },
    details: [
      ["Developer", "ConcernedApe"],
      ["Publisher", "ConcernedApe"],
      ["Released", "26 Feb 2016"],
      ["Players", "1-4 co-op"],
      ["Platforms", "Windows"],
      ["Languages", "English, Japanese + 12 more"],
    ],
    activity: {
      online: "8,764",
      items: [
        { user: "pelican.t", kind: "screenshot", text: "Posted a screenshot: finished the greenhouse layout", ago: "30m" },
        { user: "willow", kind: "guide", text: "Posted a guide: year-one money plan without cheats", ago: "4h" },
        { user: "dust_sprite", kind: "review", text: "Wrote a review: \"Open it for ten minutes, look up and it's 2 a.m.\"", ago: "1d" },
      ],
    },
    trailerSeconds: 66,
  },

  "nfs-heat": {
    tagline: "Run clean by day, run hot by night in Palm City.",
    about: [
      "In Palm City the day belongs to the sanctioned race scene and the night belongs to the street. Daytime races bank money, nighttime ones bank rep, and the police get meaner the more you earn.",
      "Cars are built and tuned freely, with a long list of parts to swap. Drive the same car in both modes and you start to feel which version of the game you actually prefer.",
    ],
    genres: ["Racing", "Open world", "Arcade"],
    esrb: { rating: "T", descriptors: "Language, violence, use of alcohol" },
    year: 2019,
    releaseDate: "8 Nov 2019",
    userRating: 78,
    reviewCount: "29K",
    metascore: 73,
    storageGb: 50,
    features: [
      { title: "Day and night split", body: "Earn money in the day, rep after dark. Spend both on your garage." },
      { title: "Heat levels", body: "More heat means better rewards and a more determined police response." },
      { title: "Deep car customization", body: "Engine, handling, body and wrap work are all done in-game." },
      { title: "Crew races", body: "Join up and take on rival crews across Palm City." },
    ],
    requirements: {
      minimum: { os: "Windows 7 SP1 64-bit", cpu: "Intel Core i5-3570 / AMD FX 6350", gpu: "NVIDIA GTX 760 / AMD Radeon R9 270", ram: "8 GB", storage: "50 GB" },
      recommended: { os: "Windows 10 64-bit", cpu: "Intel Core i7-4790 / AMD Ryzen 3 1300X", gpu: "NVIDIA GTX 1060 / AMD Radeon RX 480", ram: "8 GB", storage: "50 GB" },
    },
    media: media("nfs-heat", ["Launch trailer", "Downtown at night", "Garage customization", "Police chase", "Coastal highway", "Sunset race"]),
    studio: {
      name: "Ghost Games",
      initials: "GG",
      verified: true,
      location: "Gothenburg, Sweden",
      founded: "2013",
      bio: "Racing studio behind several recent entries in the long-running Need for Speed series.",
      team: [{ role: "Game Director" }, { role: "Lead Composer" }, { role: "Art Director" }],
      links: { site: "https://www.ea.com" },
      titles: [
        { title: "Need for Speed Payback", year: 2017, genre: "Racing" },
        { title: "Need for Speed (2015)", year: 2015, genre: "Racing" },
      ],
    },
    details: [
      ["Developer", "Ghost Games"],
      ["Publisher", "Electronic Arts"],
      ["Released", "8 Nov 2019"],
      ["Players", "Single-player, online"],
      ["Platforms", "Windows"],
      ["Languages", "English, French + 10 more"],
    ],
    activity: {
      online: "612",
      items: [
        { user: "slipstream", kind: "clip", text: "Shared a clip: five-star escape through the tunnel", ago: "2h" },
        { user: "m_octane", kind: "screenshot", text: "Posted a screenshot of a freshly wrapped Mustang", ago: "7h" },
        { user: "rev_limit", kind: "guide", text: "Posted a guide: fastest way to bank rep at night", ago: "3d" },
      ],
    },
    trailerSeconds: 58,
  },

  "warhammer-3": {
    tagline: "Armies, daemons and a map you can actually lose a campaign on.",
    about: [
      "The Chaos Realms are open and four mortal factions race to claim the Soul Cities. Campaign turns are slow and political; battles are fast, huge and full of flying monsters.",
      "Every faction plays differently on the campaign map and in the field. Plan a long campaign, then watch it come apart in a single bad engagement and decide whether to reload.",
    ],
    genres: ["Grand strategy", "Real-time tactics", "Fantasy"],
    esrb: { rating: "M", descriptors: "Blood, violence" },
    year: 2022,
    releaseDate: "17 Feb 2022",
    userRating: 85,
    reviewCount: "58K",
    metascore: 86,
    storageGb: 120,
    features: [
      { title: "Turn-based campaign", body: "Manage provinces, diplomacy and heroes on a world map." },
      { title: "Massive real-time battles", body: "Command thousands of units with fliers, monsters and magic." },
      { title: "Distinct factions", body: "Each legendary lord has unique mechanics, units and goals." },
      { title: "Realm of Chaos", body: "Race across four realms to finish the Ursun's Soul quest." },
    ],
    requirements: {
      minimum: { os: "Windows 10 64-bit", cpu: "Intel Core i3-4150 / AMD FX-6300", gpu: "NVIDIA GTX 900 series / AMD RX 400 series", ram: "8 GB", storage: "120 GB" },
      recommended: { os: "Windows 10 64-bit", cpu: "Intel Core i7-9700K / AMD Ryzen 7 2700X", gpu: "NVIDIA GTX 1080 / AMD Radeon RX Vega 64", ram: "16 GB", storage: "120 GB" },
    },
    media: media("warhammer-3", ["Cinematic trailer", "Campaign map overview", "Siege assault", "Daemon prince clash", "Frontline in the snow", "Realm of Chaos"]),
    studio: {
      name: "Creative Assembly",
      initials: "CA",
      verified: true,
      location: "Horsham, UK",
      founded: "1987",
      bio: "Strategy studio best known for the Total War series, mixing turn-based empire management with large-scale tactical battles.",
      team: [{ role: "Game Director" }, { role: "Lead Composer" }, { role: "Art Director" }],
      links: { site: "https://www.creative-assembly.com" },
      titles: [
        { title: "Total War: Warhammer II", year: 2017, genre: "Grand strategy" },
        { title: "Total War: Three Kingdoms", year: 2019, genre: "Grand strategy" },
        { title: "Alien: Isolation", year: 2014, genre: "Survival horror" },
      ],
    },
    details: [
      ["Developer", "Creative Assembly"],
      ["Publisher", "SEGA"],
      ["Released", "17 Feb 2022"],
      ["Players", "Single-player, multiplayer"],
      ["Platforms", "Windows"],
      ["Languages", "English, French + 9 more"],
    ],
    activity: {
      online: "2,044",
      items: [
        { user: "ursuns_ward", kind: "guide", text: "Posted a guide: Kislev opening turns on Legendary difficulty", ago: "1h" },
        { user: "bannerman", kind: "screenshot", text: "Posted a screenshot of a 40-unit siege", ago: "8h" },
        { user: "tzeentchling", kind: "review", text: "Wrote a review: \"Campaign mode is a time sink in the best way.\"", ago: "2d" },
      ],
    },
    trailerSeconds: 105,
  },
};