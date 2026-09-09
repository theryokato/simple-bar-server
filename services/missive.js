import * as DATA from "../data.js";

export default function missiveAction(req, res, clients, action) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed.");
    return;
  }

  if (!action) {
    res.statusCode = 400;
    res.end(
      `You need to specify an action (${DATA.MISSIVE_ACTIONS.join(", ")}).`
    );
    return;
  }

  if (!DATA.MISSIVE_ACTIONS.includes(action)) {
    res.statusCode = 400;
    res.end(`Unknown action "${action}".`);
    return;
  }

  const MAX_BODY_SIZE = 64 * 1024;
  let body = "";
  let size = 0;
  let tooLarge = false;

  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      tooLarge = true;
      return;
    }
    body += chunk;
  });

  req.on("end", () => {
    if (tooLarge) {
      res.statusCode = 413;
      res.end("Payload too large.");
      return;
    }

    try {
      const json = JSON.parse(body);
      if (!json.content) {
        res.statusCode = 400;
        res.end("Missing content.");
        return;
      }

      for (const client of clients) {
        const isTargetedWidget = client.target === "missive";

        if (isTargetedWidget) {
          client.send(JSON.stringify({ action, data: json }));
        }
      }

      res.end();
    } catch (error) {
      res.statusCode = 400;
      res.end("Invalid JSON.");
      return;
    }
  });
}
