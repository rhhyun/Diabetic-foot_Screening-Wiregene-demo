import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAppConfig } from "../app-config.mjs";
import { createAppRuntime, handleApiRequest } from "../server.mjs";

const ROOT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtime = createAppRuntime(loadAppConfig(ROOT_DIR));

export default async function handler(request, response) {
  try {
    const url = new URL(request.url || "/", `https://${request.headers.host || "localhost"}`);
    if (!url.pathname.startsWith("/api/")) {
      sendJson(response, 404, {
        ok: false,
        message: "Not found",
      });
      return;
    }

    await handleApiRequest({ request, response, url, ...runtime });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Server error",
    });
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}
