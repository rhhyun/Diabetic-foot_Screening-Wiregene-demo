const SESSION_KEY = "wiregene-diabetic-foot-demo-admin-session";

const DEMO_ADMIN = Object.freeze({
  username: "wiregene-admin",
  password: "WG-demo-2026",
  displayName: "Wiregene Demo Admin",
});

export function getDemoAdminCredentials() {
  return DEMO_ADMIN;
}

export function isDemoAdminAuthenticated() {
  return Boolean(getDemoAdminSession());
}

export async function loginDemoAdmin(username, password) {
  const normalizedUsername = String(username ?? "").trim();
  const normalizedPassword = String(password ?? "");

  const remoteResult = await tryRemoteLogin(normalizedUsername, normalizedPassword);
  if (remoteResult) {
    return remoteResult;
  }

  if (
    normalizedUsername !== DEMO_ADMIN.username ||
    normalizedPassword !== DEMO_ADMIN.password
  ) {
    return {
      ok: false,
      message: "관리자 계정 또는 비밀번호가 올바르지 않습니다.",
    };
  }

  const session = {
    username: DEMO_ADMIN.username,
    displayName: DEMO_ADMIN.displayName,
    loggedInAt: new Date().toISOString(),
    authMode: "local-demo",
  };
  persistSession(session);

  return {
    ok: true,
    session,
  };
}

export async function logoutDemoAdmin() {
  await tryRemoteLogout();
  clearSessionCache();
}

export async function syncAdminSession({ force = false } = {}) {
  const cached = getDemoAdminSession();
  if (cached && !force) {
    return cached;
  }

  const remoteSession = await tryRemoteSessionLookup();
  if (remoteSession !== undefined) {
    return remoteSession;
  }

  return getLocalSession();
}

export function getDemoAdminSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed?.username ? parsed : null;
  } catch {
    return null;
  }
}

export function renderAdminSessionRequired({
  title,
  description,
  returnPath = "./admin.html",
} = {}) {
  return `
    <main class="completion-shell">
      <section class="completion-card">
        <div class="completion-hero">
          <p class="eyebrow">Admin Session Required</p>
          <h1>${escapeHtml(title ?? "관리자 세션이 필요합니다.")}</h1>
          <p>${escapeHtml(
            description ??
              "이 화면은 관리자 세션이 활성화된 상태에서만 사용할 수 있습니다. 관리자 페이지에서 로그인한 뒤 다시 접근해 주세요.",
          )}</p>
        </div>
        <div class="alert-box top-gap">
          환자 문진은 공개로 둘 수 있지만, 관리자/임상/센서 입력은 서버 세션 또는 데모 세션 인증 뒤에만 사용할 수 있습니다.
        </div>
        <div class="button-row top-gap">
          <a class="primary-button dark link-button" href="${escapeAttribute(returnPath)}">관리자 로그인으로 이동</a>
          <a class="secondary-button link-button" href="./index.html">환자 문진으로 이동</a>
        </div>
      </section>
    </main>
  `;
}

async function tryRemoteLogin(username, password) {
  const response = await tryFetchJson("/auth/login", {
    method: "POST",
    body: {
      username,
      password,
    },
  });

  if (!response) {
    return null;
  }

  if (!response.ok) {
    return {
      ok: false,
      message: response.message || "관리자 계정 또는 비밀번호가 올바르지 않습니다.",
    };
  }

  const session = {
    ...response.session,
    authMode: "server-session",
  };
  persistSession(session);

  return {
    ok: true,
    session,
  };
}

async function tryRemoteLogout() {
  await tryFetchJson("/auth/logout", {
    method: "POST",
  });
}

async function tryRemoteSessionLookup() {
  const response = await tryFetchJson("/auth/session", {
    method: "GET",
  });

  if (!response) {
    return undefined;
  }

  if (!response.authenticated || !response.session) {
    clearSessionCache();
    return null;
  }

  const session = {
    ...response.session,
    authMode: "server-session",
  };
  persistSession(session);
  return session;
}

function getLocalSession() {
  const cached = getDemoAdminSession();
  if (!cached) {
    return null;
  }

  if (cached.username !== DEMO_ADMIN.username) {
    clearSessionCache();
    return null;
  }

  return cached;
}

function persistSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSessionCache() {
  sessionStorage.removeItem(SESSION_KEY);
}

async function tryFetchJson(path, { method = "GET", body } = {}) {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(resolveApiUrl(path), {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const payload = await safeJson(response);
    return {
      ok: response.ok,
      status: response.status,
      ...payload,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function resolveApiUrl(path) {
  const base =
    typeof window !== "undefined" && typeof window.WIREGENE_REMOTE_API_BASE === "string"
      ? window.WIREGENE_REMOTE_API_BASE
      : "/api";

  return `${base.replace(/\/$/, "")}${path}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}
