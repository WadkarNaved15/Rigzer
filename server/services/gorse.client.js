// services/gorse.client.js
// Central wrapper for all Gorse API calls.
// All calls are fire-and-forget safe — errors are logged but never thrown,
// so a Gorse outage never breaks your main app routes.

const GORSE_URL = process.env.GORSE_SERVER_URL || "http://localhost:8087";
const GORSE_API_KEY = process.env.GORSE_SERVER_API_KEY;
const headers = {
  "Content-Type": "application/json",
  "X-API-Key": GORSE_API_KEY,
};

// ── Internal fetch wrapper ────────────────────────────────────────────────────

async function gorseRequest(method, path, body) {
  const res = await fetch(`${GORSE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gorse ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json().catch(() => null);
}

// ── Users ────────────────────────────────────────────────────────────────────

/**
 * Upserts a user into Gorse.
 * Call this on signup and whenever the user's labels change.
 * @param {{ userId: string, labels?: string[] }} user
 */
export async function upsertUser({ userId, labels = [] }) {
  return gorseRequest("POST", "/api/user", {
    UserId: userId,
    Labels: labels,
  });
}

// ── Items (posts) ────────────────────────────────────────────────────────────

/**
 * Upserts a post into Gorse.
 * Call this whenever a post is created.
 * @param {{ postId: string, timestamp: Date, labels?: string[], categories?: string[] }} item
 */
export async function upsertItem({ postId, timestamp, labels = [], categories = [] }) {
  return gorseRequest("POST", "/api/item", {
    ItemId: postId,
    Timestamp: timestamp.toISOString(),
    Labels: labels,
    Categories: categories,
    IsHidden: false,
  });
}

/**
 * Hides a post from recommendations (e.g. when deleted).
 * @param {string} postId
 */
export async function hideItem(postId) {
  return gorseRequest("PATCH", `/api/item/${postId}`, {
    IsHidden: true,
  });
}

// ── Feedback ──────────────────────────────────────────────────────────────────

/**
 * Records a single feedback event.
 * @param {{ feedbackType: string, userId: string, postId: string, timestamp?: Date }} fb
 */
export async function insertFeedback({ feedbackType, userId, postId, timestamp }) {
   if (!userId || !postId) {
    console.warn("[Gorse] Skipping invalid feedback:", { feedbackType, userId, postId });
    return;
  }
  console.log("Sending feedback to Gorse:", feedbackType, userId, postId);
  return gorseRequest("POST", "/api/feedback", [{
    FeedbackType: feedbackType,
    UserId: userId,
    ItemId: postId,
    Timestamp: (timestamp || new Date()).toISOString(),
  }]);
}

/**
 * Deletes a specific feedback event (e.g. unlike, unsave).
 * @param {{ feedbackType: string, userId: string, postId: string }} fb
 */
export async function deleteFeedback({ feedbackType, userId, postId }) {
  console.log("Deleting feedback from Gorse:", feedbackType, userId, postId);
  return gorseRequest(
    "DELETE",
    `/api/feedback/${feedbackType}/${userId}/${postId}`
  );
}

/**
 * Records an impression (user scrolled past the post).
 * Call this from your feed endpoint when posts are served.
 * @param {string} userId
 * @param {string[]} postIds
 */
export async function recordServed(userId, postIds) {
  if (!userId || !postIds.length) {
    console.warn("[Gorse] Skipping served: missing userId");
    return;
  }
  console.log("Recording served to Gorse:", userId, postIds);
  if (!postIds.length) return;
  const payload = postIds.map((postId) => ({
    FeedbackType: "served",
    UserId: userId,
    ItemId: postId,
    Timestamp: new Date().toISOString(),
  }));
  return gorseRequest("POST", "/api/feedback", payload);
}

// ── Recommendations ───────────────────────────────────────────────────────────

/**
 * Fetches personalised recommendations for a user.
 * Returns an array of postIds, or [] on any error.
 * @param {{ userId: string, limit?: number, offset?: number }} opts
 * @returns {Promise<string[]>}
 */
export async function getRecommendations({ userId, limit = 20, offset = 0 }) {
  try {
    const data = await gorseRequest(
      "GET",
      `/api/recommend/${userId}?n=${limit}&offset=${offset}`
    );
    // Gorse returns [{ Id, Score }] or just string[]
    if (!Array.isArray(data)) return [];
    return data
      .map((d) => (typeof d === "string" ? d : d.Id))
      .filter((id) => typeof id === "string" && id.trim() !== "");
  } catch (err) {
    console.error("[Gorse] getRecommendations error:", err.message);
    return [];
  }
}

/**
 * Fetches trending / non-personalized popular posts.
 * Used as fallback for new/logged-out users.
 * @param {{ recommender?: string, limit?: number }} opts
 * @returns {Promise<string[]>}
 */
export async function getPopular({ recommender = "most_popular", limit = 20 }) {
  try {
    const data = await gorseRequest(
      "GET",
      `/api/popular?n=${limit}`
    );
    if (!Array.isArray(data)) return [];
    return data.map((d) => (typeof d === "string" ? d : d.Id));
  } catch (err) {
    console.error("[Gorse] getPopular error:", err.message);
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget wrapper — swallows errors so Gorse issues
 * never cause 500s in your app routes.
 * Usage: fireAndForget(() => insertFeedback(...))
 */
export function fireAndForget(fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => console.error("[Gorse] background error:", err.message));
}