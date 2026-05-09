import crypto from "node:crypto";

const COOKIE_NAME = "wiregene_admin_session";

export function createSessionStore({ ttlHours = 12, secret = "wiregene-session" } = {}) {
  const ttlMs = ttlHours * 60 * 60 * 1000;
  const signingSecret = String(secret || "wiregene-session");

  return {
    createSession(session) {
      const storedSession = {
        username: session.username,
        displayName: session.displayName,
        loggedInAt: session.loggedInAt ?? new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        nonce: crypto.randomBytes(12).toString("hex"),
      };

      return {
        ...storedSession,
        sessionId: signSession(storedSession, signingSecret),
      };
    },

    getSession(request) {
      const sessionId = parseSessionIdFromRequest(request);
      if (!sessionId) {
        return null;
      }

      const session = verifySession(sessionId, signingSecret);
      if (!session) {
        return null;
      }

      if (Date.parse(session.expiresAt) <= Date.now()) {
        return null;
      }

      return {
        ...session,
        sessionId,
      };
    },

    destroySession(request) {
      const sessionId = parseSessionIdFromRequest(request);
      return Boolean(sessionId);
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

function signSession(session, secret) {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = createSignature(payload, secret);
  return `${payload}.${signature}`;
}

function verifySession(sessionId, secret) {
  const [payload, signature] = String(sessionId).split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = createSignature(payload, secret);
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function createSignature(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
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

