import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadAppConfig,
  isGoogleDriveConfigured,
  isSupabaseConfigured,
} from "./app-config.mjs";
import { createGoogleDriveRepository } from "./google-drive-rest.mjs";
import { createSupabaseRepository } from "./supabase-rest.mjs";
import { createSessionStore } from "./session-store.mjs";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_VERSION = process.env.APP_VERSION || "0.2.2";

export function createAppServer(config = loadAppConfig(ROOT_DIR)) {
  const runtime = createAppRuntime(config);

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
        await handleApiRequest({ request, response, url, ...runtime });
        return;
      }

      await serveStaticFile(response, url.pathname, runtime.config.rootDir);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "서버 오류가 발생했습니다.",
      });
    }
  });
}

export function createAppRuntime(config = loadAppConfig(ROOT_DIR)) {
  const repository = createRepository(config);
  const sessionStore = createSessionStore({
    ttlHours: config.sessionTtlHours,
    secret: config.sessionSecret,
  });

  return {
    repository,
    config,
    sessionStore,
    readinessState: {
      lastSuccessAt: 0,
      lastFailureAt: 0,
      lastError: null,
      pending: null,
    },
  };
}

function createRepository(config) {
  if (isGoogleDriveConfigured(config)) {
    return createGoogleDriveRepository(config);
  }

  if (isSupabaseConfigured(config)) {
    const repository = createSupabaseRepository(config);
    repository.storage = {
      kind: "remote",
      label: "Supabase central DB",
      detail: "Node API + Supabase REST",
    };
    return repository;
  }

  return null;
}

export async function handleApiRequest({
  request,
  response,
  url,
  repository,
  config,
  sessionStore,
  readinessState,
}) {
  applyCorsHeaders(response, request, config);

  if (request.method === "OPTIONS") {
    if (!isAllowedCorsOrigin(request, config)) {
      sendJson(response, 403, {
        ok: false,
        message: "CORS origin not allowed",
      });
      return;
    }

    response.writeHead(204, {
      "Cache-Control": "no-store",
    });
    response.end();
    return;
  }

  const adminSession = sessionStore.getSession(request);

  if (url.pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      version: APP_VERSION,
      auth: {
        kind: "server-session",
        label: "Node in-memory session",
        detail: "httpOnly cookie based admin session",
      },
      storage: repository
        ? repository.storage
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

  if (url.pathname === "/api/ready" && request.method === "GET") {
    if (!repository) {
      sendJson(response, 503, {
        ok: false,
        version: APP_VERSION,
        message: "Remote storage is not configured.",
      });
      return;
    }

    try {
      await checkRepositoryReadiness(repository, readinessState);
      sendJson(response, 200, {
        ok: true,
        version: APP_VERSION,
        storage: repository.storage,
      });
    } catch {
      sendJson(response, 503, {
        ok: false,
        version: APP_VERSION,
        storage: repository.storage,
        message: "Remote storage readiness check failed.",
      });
    }
    return;
  }

  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      authenticated: Boolean(adminSession),
      session: adminSession ? sanitizeSession(adminSession) : null,
    });
    return;
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await readJsonBody(request);
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    if (
      username !== config.adminUsername ||
      password !== config.adminPassword
    ) {
      sendJson(response, 401, {
        ok: false,
        message: "관리자 계정 또는 비밀번호가 올바르지 않습니다.",
      });
      return;
    }

    const session = sessionStore.createSession({
      username: config.adminUsername,
      displayName: config.adminDisplayName,
      loggedInAt: new Date().toISOString(),
    });
    sessionStore.attachSessionCookie(response, session, {
      secure: isSecureRequest(request),
    });

    sendJson(response, 200, {
      ok: true,
      accessToken: session.sessionId,
      session: sanitizeSession(session),
    });
    return;
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    sessionStore.destroySession(request);
    sessionStore.clearSessionCookie(response, {
      secure: isSecureRequest(request),
    });
    sendJson(response, 200, {
      ok: true,
      loggedOut: true,
    });
    return;
  }

  if (!repository) {
    sendJson(response, 503, {
      ok: false,
      message:
        "Remote DB environment variables are not configured. Configure Google Drive or Supabase settings and redeploy.",
    });
    return;
  }

  if (url.pathname === "/api/records" && request.method === "GET") {
    if (!requireAdminSession(response, adminSession)) {
      return;
    }
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
      if (!requireAdminSession(response, adminSession)) {
        return;
      }
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
      if (!requireAdminSession(response, adminSession)) {
        return;
      }
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
      if (!requireAdminSession(response, adminSession)) {
        return;
      }
      await repository.deleteRecord(recordId);
      sendJson(response, 200, { ok: true, deleted: true });
      return;
    }
  }

  if (url.pathname === "/api/database/export" && request.method === "GET") {
    if (!requireAdminSession(response, adminSession)) {
      return;
    }
    const snapshot = await repository.exportSnapshot();
    sendJson(response, 200, snapshot);
    return;
  }

  if (url.pathname === "/api/database/import" && request.method === "POST") {
    if (!requireAdminSession(response, adminSession)) {
      return;
    }
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

async function checkRepositoryReadiness(repository, readinessState) {
  const now = Date.now();
  if (now - readinessState.lastSuccessAt < 30_000) {
    return;
  }

  if (readinessState.lastError && now - readinessState.lastFailureAt < 5_000) {
    throw readinessState.lastError;
  }

  if (!readinessState.pending) {
    const probe = repository
      .checkReady()
      .then(() => {
        readinessState.lastSuccessAt = Date.now();
        readinessState.lastFailureAt = 0;
        readinessState.lastError = null;
      })
      .catch((error) => {
        readinessState.lastFailureAt = Date.now();
        readinessState.lastError = error;
        throw error;
      })
      .finally(() => {
        if (readinessState.pending === probe) {
          readinessState.pending = null;
        }
      });
    readinessState.pending = probe;
  }

  await readinessState.pending;
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

function requireAdminSession(response, adminSession) {
  if (adminSession) {
    return true;
  }

  sendJson(response, 401, {
    ok: false,
    message: "관리자 로그인이 필요합니다.",
  });
  return false;
}

function sanitizeSession(session) {
  return {
    username: session.username,
    displayName: session.displayName,
    loggedInAt: session.loggedInAt,
    expiresAt: session.expiresAt,
  };
}

function isSecureRequest(request) {
  return (
    request.headers["x-forwarded-proto"] === "https" ||
    String(request.headers.host || "").includes(":443")
  );
}

function applyCorsHeaders(response, request, config) {
  const allowedOrigin = getAllowedCorsOrigin(request, config);
  if (!allowedOrigin) {
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.setHeader("Vary", "Origin");
}

function isAllowedCorsOrigin(request, config) {
  return Boolean(getAllowedCorsOrigin(request, config));
}

function getAllowedCorsOrigin(request, config) {
  const origin = String(request.headers.origin || "").trim();
  if (!origin) {
    return "";
  }

  if (config.corsAllowedOrigins.includes(origin)) {
    return origin;
  }

  const sameOrigin = getRequestOrigin(request);
  if (sameOrigin && origin === sameOrigin) {
    return origin;
  }

  return "";
}

function getRequestOrigin(request) {
  const host = String(request.headers.host || "").trim();
  if (!host) {
    return "";
  }

  const protocol = isSecureRequest(request) ? "https" : "http";
  return `${protocol}://${host}`;
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
  let shutdownStarted = false;

  const shutdown = (signal) => {
    if (shutdownStarted) {
      process.exit(1);
    }

    shutdownStarted = true;
    console.log(`[wiregene] received ${signal}; closing HTTP server`);

    const forceExitTimer = setTimeout(() => {
      server.closeAllConnections?.();
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    server.close((error) => {
      clearTimeout(forceExitTimer);
      process.exit(error ? 1 : 0);
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  server.listen(config.port, config.host, () => {
    const storageLabel = isGoogleDriveConfigured(config)
      ? "Google Drive JSON DB"
      : isSupabaseConfigured(config)
        ? "Supabase central DB"
        : "local fallback";
    console.log(
      `[wiregene] http://${config.host}:${config.port} (${storageLabel})`,
    );
  });
}

function isMainModule(moduleUrl) {
  return process.argv[1] === fileURLToPath(moduleUrl);
}
