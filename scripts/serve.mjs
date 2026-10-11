import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, relative, isAbsolute } from "node:path";
const base = resolve(import.meta.dirname, "../dist");
const port = Number(process.env.PORT) || 4173;
const hub = new URL(process.env.MONITOR_HUB || "http://127.0.0.1:9911");
if (!["http:", "https:"].includes(hub.protocol))
  throw new Error("MONITOR_HUB must be HTTP or HTTPS");
const request = hub.protocol === "https:" ? httpsRequest : httpRequest;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};
const isHubPath = (path) => /^\/(api|admin)(\/|$)/.test(path);
const options = (req) => ({
  protocol: hub.protocol,
  hostname: hub.hostname,
  port: hub.port,
  method: req.method,
  path: req.url,
  headers: { ...req.headers, host: hub.host },
});
const server = createServer(async (req, res) => {
  let path;
  try {
    path = decodeURIComponent(
      new URL(req.url || "/", "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }
  if (isHubPath(path)) {
    const upstream = request(options(req), (response) => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        res.end(
          "无法连接开发 Hub。请设置 MONITOR_HUB，或打开 /demo.html 查看演示。",
        );
      } else res.destroy();
    });
    upstream.setTimeout(16000, () => upstream.destroy());
    req.on("aborted", () => upstream.destroy());
    req.pipe(upstream);
    return;
  }
  if (path === "/" || !extname(path)) path = "/index.html";
  const file = resolve(join(base, path.replace(/^\/+/, "")));
  const local = relative(base, file);
  if (local.startsWith("..") || isAbsolute(local) || path.includes("\0")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type": mime[extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
});
server.on("upgrade", (req, client, head) => {
  if (!req.url?.startsWith("/api/ws")) {
    client.end("HTTP/1.1 404 Not Found\r\n\r\n");
    return;
  }
  const upstream = request(options(req));
  upstream.on("upgrade", (response, socket, upstreamHead) => {
    client.write(
      `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n` +
        response.rawHeaders.reduce(
          (s, v, i) => s + (i % 2 ? `${v}\r\n` : `${v}: `),
          "",
        ) +
        "\r\n",
    );
    if (upstreamHead.length) client.write(upstreamHead);
    if (head.length) socket.write(head);
    socket.on("error", () => client.destroy());
    client.on("error", () => socket.destroy());
    socket.on("close", () => client.destroy());
    client.on("close", () => socket.destroy());
    client.pipe(socket);
    socket.pipe(client);
  });
  upstream.on("response", (res) => {
    client.end(
      `HTTP/1.1 ${res.statusCode || 502} ${res.statusMessage || "Bad Gateway"}\r\nConnection: close\r\n\r\n`,
    );
    res.resume();
  });
  upstream.on("error", () => client.destroy());
  client.on("error", () => upstream.destroy());
  upstream.setTimeout(15000, () => upstream.destroy());
  upstream.end();
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `x86 Monitor: http://127.0.0.1:${port}/demo.html | Hub: ${hub.origin}`,
  ),
);
