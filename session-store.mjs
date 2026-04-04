import crypto from "node:crypto";

const COOKIE_NAME = "wiregene_admin_session";

export function createSessionStore({ ttlHours = 12 } = {}) {
  const ttlMs = ttlHours * 60 * 60 * 1000;
  const sessions = new Map();

  return {
    createSession(session) {
      pruneExpiredSessions(sessions, ttlMs);

      const sessionId = crypto.randomBytes(24).toString("hex");
      const storedSession = {
        sessionId,
        username: session.username,
        displayName: session.displayName,
        loggedInAt: session.loggedInAt ?? new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      };

      sessions.set(sessionId, storedSession);
      return storedSession;
    },

    getSession(request) {
      pruneExpiredSessions(sessions, ttlMs);
      const sessionId = parseSessionIdFromRequest(request);
      if (!sessionId) {
        return null;
      }

      const session = sessions.get(sessionId);
      if (!session) {
        return null;
      }

      if (Date.parse(session.expiresAt) <= Date.now()) {
        sessions.delete(sessionId);
        return null;
      }

      const refreshed = {
        ...session,
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      };
      sessions.set(sessionId, refreshed);
      return refreshed;
    },

    destroySession(request) {
      const sessionId = parseSessionIdFromRequest(request);
      if (!sessionId) {
        return false;
      }
      return sessions.delete(sessionId);
    },

    attachSessionCookie(response, session, { secure = false } = {}) {
      const parts = [
        `${COOKIE_NAME}=${session.sessionId}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${Math.floor(ttlMs / 1000)}`,
      ];

      if (secure) {
        parts.push("Secure");
      }

      response.setHeader("Set-Cookie", parts.join("; "));
    },

    clearSessionCookie(response, { secure = false } = {}) {
      const parts = [
        `${COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0",
      ];

      if (secure) {
        parts.push("Secure");
      }

      response.setHeader("Set-Cookie", parts.join("; "));
    },
  };
}

function parseSessionIdFromRequest(request) {
  const authorization = String(request.headers.authorization || "");
  if (authorization.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (token) {
      return token;
    }
  }

  const cookies = parseCookies(request.headers.cookie);
  return cookies[COOKIE_NAME] || "";
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return acc;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function pruneExpiredSessions(sessions, ttlMs) {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    const expiresAt = Date.parse(session.expiresAt ?? 0);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
}
