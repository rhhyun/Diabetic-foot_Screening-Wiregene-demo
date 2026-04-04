import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAppConfig, isSupabaseConfigured } from "./server/lib/env.mjs";
import { createSupabaseRepository } from "./supabase-rest.mjs";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

export function createAppServer(config = loadAppConfig(ROOT_DIR)) {
  const repository = isSupabaseConfigured(config)
    ? createSupabaseRepository(config)
    : null;

  return http.createServer(async (request, response) => {
    try {
      if (!request.url) {
        sendJson(response, 400, {
          ok: false,
          message: "잘못된 요청입니다.",
        });
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

      if (url.pathname.startsWith("/api/")) {
        await handleApiRequest({ request, response, url, repository, config });
        return;
      }

      await serveStaticFile(response, url.pathname, config.rootDir);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "서버 오류가 발생했습니다.",
      });
    }
  });
}

async function handleApiRequest({ request, response, url, repository, config }) {
  if (url.pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      storage: repository
        ? {
            kind: "remote",
            label: "Supabase central DB",
            detail: "Node API + Supabase REST 연결",
          }
        : {
            kind: "local",
            label: "Browser localStorage",
            detail: "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없어 local fallback 모드입니다.",
          },
      config: {
        host: config.host,
        port: config.port,
      },
    });
    return;
  }

  if (!repository) {
    sendJson(response, 503, {
      ok: false,
      message:
        "Supabase 환경변수가 설정되지 않아 중앙 DB API를 사용할 수 없습니다. .env를 구성한 뒤 서버를 다시 시작해 주세요.",
    });
    return;
  }

  if (url.pathname === "/api/records" && request.method === "GET") {
    const records = await repository.listRecords();
    sendJson(response, 200, { ok: true, records });
    return;
  }

  if (url.pathname === "/api/records" && request.method === "POST") {
    const body = await readJsonBody(request);
    const saved = await repository.upsertRecord(body.record);
    sendJson(response, 201, { ok: true, record: saved });
    return;
  }

  if (url.pathname.startsWith("/api/records/")) {
    const recordId = decodeURIComponent(url.pathname.slice("/api/records/".length));
    if (!recordId) {
      sendJson(response, 400, {
        ok: false,
        message: "recordId가 필요합니다.",
      });
      return;
    }

    if (request.method === "GET") {
      const record = await repository.getRecord(recordId);
      if (!record) {
        sendJson(response, 404, {
          ok: false,
          message: "해당 record를 찾지 못했습니다.",
        });
        return;
      }

      sendJson(response, 200, { ok: true, record });
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      const current = await repository.getRecord(recordId);
      if (!current) {
        sendJson(response, 404, {
          ok: false,
          message: "수정할 record를 찾지 못했습니다.",
        });
        return;
      }

      const nextRecord = {
        ...structuredClone(body.record ?? {}),
        recordId,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };

      const saved = await repository.upsertRecord(nextRecord);
      sendJson(response, 200, { ok: true, record: saved });
      return;
    }

    if (request.method === "DELETE") {
      await repository.deleteRecord(recordId);
      sendJson(response, 200, { ok: true, deleted: true });
      return;
    }
  }

  if (url.pathname === "/api/database/export" && request.method === "GET") {
    const snapshot = await repository.exportSnapshot();
    sendJson(response, 200, snapshot);
    return;
  }

  if (url.pathname === "/api/database/import" && request.method === "POST") {
    const body = await readJsonBody(request);
    const result = await repository.importSnapshot(body.snapshot, {
      mode: body.mode === "replace" ? "replace" : "merge",
    });
    sendJson(response, 200, result);
    return;
  }

  sendJson(response, 404, {
    ok: false,
    message: "지원하지 않는 API 경로입니다.",
  });
}

async function serveStaticFile(response, pathname, rootDir) {
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = path.join(rootDir, normalizedPath);

  if (!absolutePath.startsWith(rootDir)) {
    sendPlainText(response, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(absolutePath);
    response.writeHead(200, {
      "Content-Type": contentTypeFor(absolutePath),
      "Cache-Control": absolutePath.endsWith(".html") ? "no-store" : "public, max-age=300",
    });
    response.end(content);
  } catch {
    sendPlainText(response, 404, "Not Found");
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) {
      throw new Error("요청 본문이 너무 큽니다.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendPlainText(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(payload);
}

function contentTypeFor(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".mjs":
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

if (isMainModule(import.meta.url)) {
  const config = loadAppConfig(ROOT_DIR);
  const server = createAppServer(config);
  server.listen(config.port, config.host, () => {
    console.log(
      `[wiregene] http://${config.host}:${config.port} (${isSupabaseConfigured(config) ? "Supabase central DB" : "local fallback"})`,
    );
  });
}

function isMainModule(moduleUrl) {
  return process.argv[1] === fileURLToPath(moduleUrl);
}
