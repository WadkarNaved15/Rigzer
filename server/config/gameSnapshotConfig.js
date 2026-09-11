export const GAME_SNAPSHOT_SOURCE_REGION =
  process.env.GAME_SNAPSHOT_SOURCE_REGION || "ap-south-1";

export const GAME_SNAPSHOT_REGIONS = (
  process.env.GAME_SNAPSHOT_REGIONS ||
  "ap-south-1,ap-southeast-1,eu-central-1,us-east-1"
)
  .split(",")
  .map(region => region.trim())
  .filter(Boolean);

if (!GAME_SNAPSHOT_REGIONS.includes(GAME_SNAPSHOT_SOURCE_REGION)) {
  throw new Error(
    `GAME_SNAPSHOT_SOURCE_REGION (${GAME_SNAPSHOT_SOURCE_REGION}) ` +
    `must be included in GAME_SNAPSHOT_REGIONS`
  );
}

if (new Set(GAME_SNAPSHOT_REGIONS).size !== GAME_SNAPSHOT_REGIONS.length) {
  throw new Error(
    `GAME_SNAPSHOT_REGIONS contains duplicate regions: ${
      GAME_SNAPSHOT_REGIONS.join(", ")
    }`
  );
}
