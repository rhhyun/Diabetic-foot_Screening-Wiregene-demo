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
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw);
    return parsed?.username === DEMO_ADMIN.username;
  } catch {
    return false;
  }
}

export function loginDemoAdmin(username, password) {
  const normalizedUsername = String(username ?? "").trim();
  const normalizedPassword = String(password ?? "");

  if (
    normalizedUsername !== DEMO_ADMIN.username ||
    normalizedPassword !== DEMO_ADMIN.password
  ) {
    return {
      ok: false,
      message: "관리자 계정 또는 비밀번호가 올바르지 않습니다.",
    };
  }

  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: DEMO_ADMIN.username,
      displayName: DEMO_ADMIN.displayName,
      loggedInAt: new Date().toISOString(),
    }),
  );

  return {
    ok: true,
    session: getDemoAdminSession(),
  };
}

export function logoutDemoAdmin() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getDemoAdminSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (parsed?.username !== DEMO_ADMIN.username) {
      return null;
    }

    return parsed;
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
          환자 설문 화면은 공개 데모로 유지되지만, 관리자·임상·센서 입력 화면은 같은 브라우저 세션의 관리자 인증을 확인합니다.
        </div>
        <div class="button-row top-gap">
          <a class="primary-button dark link-button" href="${escapeAttribute(returnPath)}">관리자 로그인으로 이동</a>
          <a class="secondary-button link-button" href="./index.html">환자 설문으로 이동</a>
        </div>
      </section>
    </main>
  `;
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
