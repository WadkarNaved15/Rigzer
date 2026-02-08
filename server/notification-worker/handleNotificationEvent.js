import Notification from "../models/Notifications.js";

export const handleNotificationEvent = async (event) => {
  const { type, actorId, recipientId, postId } = event;

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  await Notification.findOneAndUpdate(
    {
      recipientId,
      type,
      postId: postId || null,
      createdAt: { $gte: tenMinutesAgo },
      isRead: false,
    },
    {
      // ✅ Increment count safely
      $inc: { count: 1 },

      // ✅ Keep last 3 actors
      $push: {
        actorsPreview: {
          $each: [actorId],
          $position: 0,
          $slice: 3,
        },
      },

      // ✅ Only set these when document is first created
      $setOnInsert: {
        recipientId,
        type,
        postId: postId || null,
        createdAt: new Date(),
        isRead: false,
      },
    },
    { upsert: true, new: true }
  );

  console.log("✅ Notification Stored / Aggregated");
};
