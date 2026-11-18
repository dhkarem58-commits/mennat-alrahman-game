import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function tryServeStaticFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rootDir: string,
): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const rawUrl = req.url || "/";
  const urlPath = decodeURIComponent(rawUrl.split("?")[0]);
  const cleanRel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const resolved = path.resolve(rootDir, cleanRel);
  if (!resolved.startsWith(path.resolve(rootDir))) return false;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return false;

  const ext = path.extname(resolved).toLowerCase();
  res.statusCode = 200;
  res.setHeader("content-type", MIME_BY_EXT[ext] || "application/octet-stream");
  res.setHeader("x-content-type-options", "nosniff");
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  fs.createReadStream(resolved).pipe(res);
  return true;
}

export async function startServer(customPort?: number) {
  const isProd = process.env.NODE_ENV === "production";
  const distDir = path.join(__dirname, "dist");
  const publicDir = path.join(__dirname, "public");
  const httpServer = http.createServer();

  let viteMiddleware:
    | ((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void)
    | null = null;

  if (!isProd || !fs.existsSync(path.join(distDir, "index.html"))) {
    const vite = await createViteServer({
      root: __dirname,
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        allowedHosts: true,
      },
      appType: "spa",
    });
    viteMiddleware = vite.middlewares;
  }

  httpServer.on("request", (req, res) => {
    if (viteMiddleware) {
      viteMiddleware(req, res, () => {
        if (!res.headersSent) {
          res.statusCode = 404;
          res.end("Not Found");
        }
      });
      return;
    }

    if (tryServeStaticFile(req, res, distDir)) return;
    if (tryServeStaticFile(req, res, publicDir)) return;

    const indexPath = path.join(distDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
    res.statusCode = 404;
    res.end("Not Found");
  });

  const listenPort = customPort ?? PORT;
  await new Promise<void>((resolve) => {
    httpServer.listen(listenPort, HOST, () => {
      console.log(`Server listening on http://${HOST}:${listenPort}`);
      resolve();
    });
  });

  return httpServer;
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(url.fileURLToPath(import.meta.url));

if (isMainModule) {
  void startServer();
}
