type QueueEntry = {
  desired: boolean;
  confirmed: boolean;
  confirmedCount: number;
  hasCount: boolean;
  running: boolean;
  update: (active: boolean, count?: number) => void;
  send: (active: boolean) => Promise<number | void>;
};

type ToggleOptions = {
  key: string;
  initialActive: boolean;
  initialCount?: number;
  update: (active: boolean, count?: number) => void;
  send: (active: boolean) => Promise<number | void>;
};

const queues = new Map<string, QueueEntry>();

export function togglePostState(options: ToggleOptions) {
  const {
    key,
    initialActive,
    initialCount,
    update,
    send,
  } = options;

  let entry = queues.get(key);

  if (!entry) {
    entry = {
      desired: initialActive,
      confirmed: initialActive,
      confirmedCount: initialCount ?? 0,
      hasCount: initialCount !== undefined,
      running: false,
      update,
      send,
    };

    queues.set(key, entry);
  }

  // Always use the latest callbacks from the current hook instance.
  entry.update = update;
  entry.send = send;

  // Toggle the desired state immediately, without waiting for the server.
  entry.desired = !entry.desired;

  const optimisticCount = entry.hasCount
    ? entry.confirmedCount +
      (entry.desired ? 1 : 0) -
      (entry.confirmed ? 1 : 0)
    : undefined;

  entry.update(entry.desired, optimisticCount);

  if (!entry.running) {
    void processQueue(key, entry);
  }
}

async function processQueue(key: string, entry: QueueEntry) {
  entry.running = true;

  try {
    while (entry.confirmed !== entry.desired) {
      const target = entry.desired;

      try {
        const serverCount = await entry.send(target);

        // This request succeeded, so record its confirmed state.
        entry.confirmed = target;

        if (typeof serverCount === "number") {
          entry.confirmedCount = serverCount;
        } else if (entry.hasCount) {
          entry.confirmedCount += target ? 1 : -1;
        }

        // Preserve any newer optimistic click while another request is needed.
        const displayedCount = entry.hasCount
          ? entry.confirmedCount +
            (entry.desired ? 1 : 0) -
            (entry.confirmed ? 1 : 0)
          : undefined;

        entry.update(entry.desired, displayedCount);
      } catch (error) {
        console.error(`Failed to update post state (${key}):`, error);

        // A request failed. Restore the last confirmed state.
        entry.desired = entry.confirmed;
        entry.update(
          entry.confirmed,
          entry.hasCount ? entry.confirmedCount : undefined
        );

        break;
      }
    }
  } finally {
    entry.running = false;

    // Remove idle entries so future interactions initialize from current state.
    if (queues.get(key) === entry) {
      queues.delete(key);
    }
  }
}