// services/sessionSubscriber.js
import { sub, SESSION_CHANNEL_PREFIX } from "./sessionPubSub.js";
import { sessionStreams } from "./sessionStream.js";

export async function startSessionSubscriber() {
  await sub.pSubscribe(`${SESSION_CHANNEL_PREFIX}*`, (message, channel) => {
    const sessionId = channel.replace(SESSION_CHANNEL_PREFIX, "");
    const send = sessionStreams.get(sessionId);

    if (send) {
      send(JSON.parse(message));
    }
  });

  console.log("📡 Redis session SSE subscriber ready");
}
