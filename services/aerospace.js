import Queue from "../utils/queue.js";
import * as DATA from "../data.js";

const queues = {
  spaces: new Queue(),
  space: new Queue(),
};

export default function aerospaceAction(res, clients, kind, action, params) {
  if (!kind) {
    res.statusCode = 400;
    res.end("Missing kind name.");
    return;
  }

  if (!DATA.AEROSPACE.includes(kind)) {
    res.statusCode = 400;
    res.end(`Unknown kind "${kind}".`);
    return;
  }

  if (!action) {
    res.statusCode = 400;
    res.end(
      `You need to specify an action (${DATA.AEROSPACE_ACTIONS.join(", ")}).`,
    );
    return;
  }

  if (!DATA.AEROSPACE_ACTIONS.includes(action)) {
    res.statusCode = 400;
    res.end(`Unknown action "${action}".`);
    return;
  }

  const space = params.get("space");

  queues[kind].enqueue(action);

  if (space && space.trim()) {
    queues.space.enqueue(space);
  }

  setTimeout(() => {
    for (const client of clients) {
      // ws throws when sending on a closing/closed socket, which would abort
      // delivery to remaining clients and skip the queue drain below
      if (client.readyState !== 1 /* WebSocket.OPEN */) continue;

      const isTargetedWidget = client.target === kind;

      if (isTargetedWidget) {
        const action = queues[kind].peek();
        const space = queues.space.get();
        if (action && space) {
          client.send(JSON.stringify({ action, data: { space } }));
        } else if (action) {
          client.send(JSON.stringify({ action }));
        }
      }
    }

    queues[kind].empty();
    // A stale space must never leak into a later request that had no
    // ?space= param, otherwise the optimistic highlight briefly uses a
    // previous workspace. Drain it with the action queue on every request.
    queues.space.empty();
  }, 10);
}
