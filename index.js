import http from "http";
import { WebSocketServer } from "ws";
import config from "./config.js";
import widgetAction from "./services/widget.js";
import yabaiAction from "./services/yabai.js";
import skhdAction from "./services/skhd.js";
import aerospaceAction from "./services/aerospace.js";
import missiveAction from "./services/missive.js";
import * as DATA from "./data.js";

process.title = "simple-bar-server";

const wssServer = http.createServer();
wssServer.listen(config.ports.ws, "127.0.0.1");

const wss = new WebSocketServer({ server: wssServer });

const server = http.createServer((req, res) => {
  // setHeader (not writeHead) so services can still set an error status
  // before the response ends; writeHead(200, ...) would commit it immediately.
  res.setHeader("Content-Type", "text/plain");

  const url = new URL(req.url, "http://localhost");
  const urlSegments = url.pathname.split("/").slice(1);
  const [realm, kind, action, userWidgetIndex] = urlSegments;
  const params = new URLSearchParams(url.search);

  if (!realm) {
    res.statusCode = 400;
    res.end(`Missing realm name (${DATA.REALMS.join(", ")}).`);
    return;
  }

  if (!DATA.REALMS.includes(realm)) {
    res.statusCode = 400;
    res.end(`Unknown realm "${realm}".`);
    return;
  }

  if (realm === "widget") {
    widgetAction(res, wss.clients, kind, action, userWidgetIndex);
  }

  if (realm === "yabai") {
    yabaiAction(res, wss.clients, kind, action);
  }

  if (realm === "skhd") {
    skhdAction(res, wss.clients, kind, action);
  }

  if (realm === "aerospace") {
    aerospaceAction(res, wss.clients, kind, action, params);
  }

  if (realm === "missive") {
    // missiveAction answers asynchronously once the request body has been
    // fully consumed, so it must own res.end() — closing the response here
    // would commit a 200 before any status check can run.
    missiveAction(req, res, wss.clients, kind);
    return;
  }

  res.end();
});

server.listen(config.ports.http, "127.0.0.1");

server.on("listening", () => {
  console.info(
    `simple-bar-server running at http://localhost:${config.ports.http}`,
  );
});

wss.on("connection", (ws, req) => {
  // Browsers attached an http(s) Origin; only allow loopback origins so a
  // random webpage cannot open a socket and receive pushed data. Non-browser
  // local clients (curl, scripts, Übersicht's file:// webview with a null
  // origin) send no http origin and are unaffected.
  if (req.headers.origin?.startsWith("http")) {
    try {
      const { hostname } = new URL(req.headers.origin);
      if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
        ws.close();
        return;
      }
    } catch {
      ws.close();
      return;
    }
  }

  const url = new URL(req.url, "http://localhost");
  const target = url.searchParams.get("target");
  const userWidgetIndex = url.searchParams.get("userWidgetIndex");

  if (!target) {
    ws.close();
    return;
  }

  Object.assign(ws, { target, userWidgetIndex });
});
