import {
  buildCombinedResearchRecord,
  buildResearchInsights,
  createInitialQuestionnaireAnswers,
} from "./models.mjs";
import {
  deleteSavedResearchRecord,
  exportResearchDatabaseSnapshot,
  exportResearchRecord,
  getStorageBackendStatus,
  importResearchDatabaseSnapshot,
  listSavedResearchRecords,
  saveNewResearchRecord,
  updateSavedResearchRecord,
} from "./storage.mjs";
import {
  getDemoAdminCredentials,
  getDemoAdminSession,
  isDemoAdminAuthenticated,
  loginDemoAdmin,
  logoutDemoAdmin,
  syncAdminSession,
} from "./auth.mjs";

const root = document.querySelector("#app");
const demoAdmin = getDemoAdminCredentials();

const OPTIONS = {
  gender: [
    { value: "MALE", label: "남성" },
    { value: "FEMALE", label: "여성" },
  ],
  diagnosisDuration: [
    { value: "UNDER_1_YEAR", label: "1년 미만" },
    { value: "YEAR_1_TO_5", label: "1-5년" },
    { value: "YEAR_5_TO_10", label: "5-10년" },
    { value: "OVER_10_YEARS", label: "10년 이상" },
    { value: "UNKNOWN", label: "모름" },
  ],
  treatmentType: [
    { value: "NONE", label: "치료 안 함" },
    { value: "ORAL_MEDICATION", label: "경구약" },
    { value: "INSULIN", label: "인슐린" },
    { value: "ORAL_AND_INSULIN", label: "경구약 + 인슐린" },
    { value: "UNKNOWN", label: "모름" },
  ],
  yesNo: [
    { value: "YES", label: "예" },
    { value: "NO", label: "아니오" },
  ],
  yesNoUnknown: [
    { value: "YES", label: "예" },
    { value: "NO", label: "아니오" },
    { value: "UNKNOWN", label: "모름" },
  ],
  hbA1cMode: [
    { value: "ENTER_VALUE", label: "수치 입력" },
    { value: "UNKNOWN", label: "모름" },
  ],
  diagnosedConditions: [
    { value: "DIABETIC_FOOT", label: "당뇨발" },
    { value: "NEUROPATHY", label: "말초신경병증" },
    { value: "PAD", label: "말초동맥질환" },
    { value: "NONE", label: "없음" },
    { value: "UNKNOWN", label: "모름" },
  ],
  frequency4: [
    { value: "NONE", label: "없음" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "OFTEN", label: "자주" },
    { value: "ALMOST_ALWAYS", label: "거의 항상" },
  ],
  nightPain: [
    { value: "NONE", label: "없음" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "OFTEN", label: "자주" },
    { value: "ALMOST_ALWAYS", label: "항상" },
  ],
  threeLevel: [
    { value: "NONE", label: "없음" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "OFTEN", label: "자주" },
  ],
  footCheck: [
    { value: "DAILY", label: "매일" },
    { value: "WEEKLY_2_3", label: "주 2-3회" },
    { value: "RARELY", label: "거의 안 함" },
    { value: "NEVER", label: "전혀 안 함" },
  ],
  care: [
    { value: "ALWAYS", label: "항상" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "RARELY", label: "거의 안 함" },
  ],
  barefoot: [
    { value: "NEVER", label: "없음" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "OFTEN", label: "자주" },
  ],
  tightShoes: [
    { value: "NO", label: "아니오" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "OFTEN", label: "자주" },
  ],
  walkingTime: [
    { value: "UNDER_30_MIN", label: "30분 미만" },
    { value: "MIN_30_TO_60", label: "30분-1시간" },
    { value: "HOUR_1_TO_2", label: "1-2시간" },
    { value: "OVER_2_HOURS", label: "2시간 이상" },
  ],
  smoking: [
    { value: "NO", label: "비흡연" },
    { value: "PAST", label: "과거 흡연" },
    { value: "CURRENT", label: "현재 흡연" },
  ],
  sensorStudy: [
    { value: "YES", label: "참여 희망" },
    { value: "NO", label: "희망 안 함" },
    { value: "LATER", label: "추후 결정" },
  ],
  presentAbsentUnknown: [
    { value: "NO", label: "없음" },
    { value: "YES", label: "있음" },
    { value: "UNKNOWN", label: "모름" },
  ],
};

const state = {
  records: [],
  selectedRecordId: null,
  form: createInitialQuestionnaireAnswers(),
  saveMessage: "",
  dbMessage: "",
  importMode: "merge",
  storageBackend: {
    kind: "local",
    label: "Browser localStorage",
    detail: "정적 데모 모드",
  },
  auth: {
    username: demoAdmin.username,
    password: "",
    error: "",
    isAuthenticated: isDemoAdminAuthenticated(),
    session: getDemoAdminSession(),
  },
};

render();
initialize();

root.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const { action } = target.dataset;

  if (action === "login-admin") {
    await handleLogin();
  } else if (action === "logout-admin") {
    await handleLogout();
  } else if (!state.auth.isAuthenticated) {
    return;
  } else if (action === "refresh-records") {
    await refreshStorageBackend();
    await refreshRecords();
  } else if (action === "select-record") {
    state.selectedRecordId = target.dataset.recordId;
    syncFormWithSelection();
  } else if (action === "toggle-condition") {
    toggleCondition(target.dataset.value);
  } else if (action === "save-questionnaire") {
    await saveQuestionnaire();
  } else if (action === "reset-form") {
    syncFormWithSelection();
  } else if (action === "delete-record") {
    await deleteSelectedRecord();
  } else if (action === "export-record") {
    exportResearchRecord(getWorkingRecord());
  } else if (action === "export-database") {
    await exportResearchDatabaseSnapshot();
    state.dbMessage = "현재 브라우저의 연구 DB를 JSON으로 내보냈습니다.";
  } else if (action === "set-import-mode") {
    state.importMode = target.dataset.mode === "replace" ? "replace" : "merge";
    state.dbMessage =
      state.importMode === "replace"
        ? "다음 JSON 업로드는 현재 브라우저 DB를 전체 교체합니다."
        : "다음 JSON 업로드는 기존 브라우저 DB와 병합됩니다.";
  }

  render();
});

root.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
    return;
  }

  if (target instanceof HTMLInputElement && target.type === "file" && target.dataset.action === "import-database") {
    if (!state.auth.isAuthenticated) {
      return;
    }

    const file = target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const result = await importResearchDatabaseSnapshot(text, {
        mode: state.importMode,
      });
      state.dbMessage = result.message;
      await refreshStorageBackend();
      await refreshRecords();
    } catch {
      state.dbMessage = "JSON 형식이 올바르지 않거나 연구 DB 형식을 인식하지 못했습니다.";
    }

    render();
    return;
  }

  if (!state.auth.isAuthenticated) {
    return;
  }

  const { section, field } = target.dataset;
  if (!section || !field) {
    return;
  }

  state.form[section][field] = target.value || null;
  state.saveMessage = "";
  render();
});

root.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const authField = target.dataset.authField;
  if (authField) {
    state.auth[authField] = target.value;
    state.auth.error = "";
    return;
  }

  if (!state.auth.isAuthenticated) {
    return;
  }

  const { section, field } = target.dataset;
  if (!section || !field) {
    return;
  }

  state.form[section][field] = target.value;
  state.saveMessage = "";
});

async function initialize() {
  await syncAdminAuthState();
  await refreshStorageBackend();
  if (state.auth.isAuthenticated) {
    await refreshRecords();
  }
  render();
}

async function refreshStorageBackend() {
  state.storageBackend = await getStorageBackendStatus({
    forceRefresh: true,
  });
}

async function syncAdminAuthState({ force = true } = {}) {
  const session = await syncAdminSession({
    force,
  });
  state.auth.isAuthenticated = Boolean(session);
  state.auth.session = session;
  return session;
}

async function handleLogin() {
  const result = await loginDemoAdmin(state.auth.username, state.auth.password);
  if (!result.ok) {
    state.auth.error = result.message;
    render();
    return;
  }

  state.auth.isAuthenticated = true;
  state.auth.session = result.session;
  state.auth.error = "";
  state.auth.password = "";
  await initialize();
}

async function handleLogout() {
  await logoutDemoAdmin();
  state.auth.isAuthenticated = false;
  state.auth.session = null;
  state.auth.password = "";
  state.auth.error = "";
  state.saveMessage = "";
  state.dbMessage = "";
  render();
}

async function refreshRecords() {
  try {
    state.records = await listSavedResearchRecords();
    if (!state.selectedRecordId || !state.records.some((record) => record.recordId === state.selectedRecordId)) {
      state.selectedRecordId = state.records[0]?.recordId ?? null;
    }
    syncFormWithSelection();
  } catch (error) {
    if (error?.status === 401) {
      await syncAdminAuthState({
        force: true,
      });
      state.records = [];
      state.selectedRecordId = null;
      syncFormWithSelection();
      state.dbMessage = "서버 관리자 세션이 만료되었습니다. 다시 로그인해 주세요.";
      return;
    }

    throw error;
  }
}

function syncFormWithSelection() {
  const selected = getSelectedRecord();
  state.form = selected
    ? structuredClone(selected.questionnairePayload.questionnaireData)
    : createInitialQuestionnaireAnswers();
  state.saveMessage = "";
}

function getSelectedRecord() {
  if (!state.selectedRecordId) {
    return null;
  }

  return state.records.find((record) => record.recordId === state.selectedRecordId) ?? null;
}

function getWorkingRecord() {
  const selected = getSelectedRecord();
  const combined = buildWorkingCombinedRecord();
  const now = combined.questionnairePayload.submittedAt;

  return {
    ...combined,
    recordId: selected?.recordId ?? "DEMO-QUESTIONNAIRE-DRAFT",
    createdAt: selected?.createdAt ?? now,
    updatedAt: selected?.updatedAt ?? now,
    patientSummary: buildWorkingPatientSummary(combined, state.form),
  };
}

function buildWorkingCombinedRecord() {
  const selected = getSelectedRecord();
  return buildCombinedResearchRecord({
    questionnaireAnswers: structuredClone(state.form),
    clinicianMeasurements: selected?.clinicianMeasurements
      ? structuredClone(selected.clinicianMeasurements)
      : undefined,
    longitudinalFeatures: selected?.aiFeatureGroups?.timeSeries
      ? structuredClone(selected.aiFeatureGroups.timeSeries)
      : undefined,
    sensorFeatureBundle: selected?.aiFeatureGroups?.sensor
      ? structuredClone(selected.aiFeatureGroups.sensor)
      : undefined,
    ruleFusionSignals: selected?.ruleFusionSignals
      ? structuredClone(selected.ruleFusionSignals)
      : undefined,
  });
}

function buildWorkingPatientSummary(record, form) {
  return {
    submittedAt: record.questionnairePayload.submittedAt,
    sex: labelFor(OPTIONS.gender, form.demographics.gender),
    age: form.demographics.age || "미입력",
    nameMasked: form.demographics.fullName || "미입력",
    phoneMasked: formatPhoneNumber(form.demographics.phoneNumber),
    emailMasked: form.demographics.emailAddress || "미입력",
    appRiskClass: record.questionnairePayload.internalScores.app_risk_class,
    activeConcern: record.questionnairePayload.internalFlags.active_concerning_foot_symptom,
  };
}

function toggleCondition(value) {
  const selected = state.form.history.diagnosedConditions;
  if (value === "NONE" || value === "UNKNOWN") {
    state.form.history.diagnosedConditions = selected.includes(value) ? [] : [value];
  } else {
    const filtered = selected.filter((item) => item !== "NONE" && item !== "UNKNOWN");
    state.form.history.diagnosedConditions = filtered.includes(value)
      ? filtered.filter((item) => item !== value)
      : [...filtered, value];
  }
  state.saveMessage = "";
}

async function saveQuestionnaire() {
  const selected = getSelectedRecord();
  const nextRecord = buildWorkingCombinedRecord();

  if (!selected) {
    const saved = await saveNewResearchRecord(nextRecord);
    state.selectedRecordId = saved.recordId;
    await refreshRecords();
    state.saveMessage = "관리자 초안 record를 새로 저장했습니다.";
    return;
  }

  const saved = await updateSavedResearchRecord(selected.recordId, nextRecord);
  if (saved) {
    await refreshRecords();
    state.saveMessage = "문진 정보와 예측 요약을 현재 record에 반영했습니다.";
  }
}

async function deleteSelectedRecord() {
  const selected = getSelectedRecord();
  if (!selected) {
    return;
  }

  const confirmed = window.confirm(`record ${selected.recordId} 를 삭제하시겠습니까?`);
  if (!confirmed) {
    return;
  }

  await deleteSavedResearchRecord(selected.recordId);
  await refreshRecords();
  state.saveMessage = "선택한 record를 삭제했습니다.";
}

function render() {
  if (!state.auth.isAuthenticated) {
    root.innerHTML = renderLoginScreen();
    return;
  }

  const selected = getSelectedRecord();
  const working = getWorkingRecord();
  const insights = getRecordInsights(working);
  const portfolio = buildPortfolioMetrics(state.records);
  const isDraft = !selected;
  const scores = working.questionnairePayload.internalScores;

  root.innerHTML = `
    <main class="app-shell admin-shell">
      <aside class="side-panel">
        <section class="hero-card">
          <p class="eyebrow">Admin Workspace</p>
          <h1><span>브라우저형 연구 DB 운영</span><span>관리자 페이지</span></h1>
          <p>공개 데모 환경에서도 관리자 로그인, JSON 백업/복원, 분석 요약, 예측 대시보드를 함께 시연할 수 있도록 확장한 버전입니다.</p>
        </section>
        <section class="progress-card">
          <p class="eyebrow tint">운영 현황</p>
          <p class="metric-value">${state.records.length}</p>
          <p class="helper-text">${escapeHtml(state.storageBackend.label)} · ${escapeHtml(state.storageBackend.detail)}</p>
          <p class="progress-copy">브라우저에 저장된 연구 record 수</p>
          <div class="button-row compact top-gap">
            <button class="secondary-button small" data-action="refresh-records">새로고침</button>
            <button class="secondary-button small" data-action="export-database">전체 DB 내보내기</button>
            <button class="secondary-button small" data-action="logout-admin">로그아웃</button>
          </div>
          <div class="button-row compact top-gap">
            <a class="secondary-button small link-button" href="./clinician.html">임상 입력</a>
            <a class="secondary-button small link-button" href="./sensor.html">센서 입력</a>
            <a class="secondary-button small link-button" href="./index.html">환자 문진</a>
          </div>
        </section>
        <section class="empty-card">
          <strong>DB 가져오기</strong>
          <p>JSON 스냅샷 또는 단일 record JSON을 현재 브라우저 DB에 병합하거나 전체 교체할 수 있습니다.</p>
          <div class="button-row compact top-gap">
            <button class="secondary-button small ${state.importMode === "merge" ? "is-active" : ""}" data-action="set-import-mode" data-mode="merge">병합</button>
            <button class="secondary-button small ${state.importMode === "replace" ? "is-active" : ""}" data-action="set-import-mode" data-mode="replace">전체 교체</button>
          </div>
          <label class="text-field top-gap file-input-wrap">
            <input type="file" accept=".json,application/json" data-action="import-database" />
          </label>
          <p class="helper-text">현재 모드: ${state.importMode === "replace" ? "업로드한 JSON으로 전체 교체" : "기존 DB와 병합"}</p>
        </section>
        <div class="record-list">
          ${state.records.length ? state.records.map(renderRecordChip).join("") : renderEmptyRecordList()}
        </div>
      </aside>
      <section class="main-panel">
        <header class="panel-header">
          <div class="header-top-row">
            <div class="badge-row">
              <span class="badge">Admin Edit</span>
              <span class="badge soft">${isDraft ? "Draft" : "Saved Record"}</span>
              <span class="badge warm">${insights.predictionSummary.overallLevel}</span>
              <span class="badge soft">${escapeHtml(state.storageBackend.kind === "remote" ? "Central DB" : "Browser DB")}</span>
            </div>
            <div class="top-copyright">${escapeHtml(state.auth.session?.displayName ?? demoAdmin.displayName)}</div>
          </div>
          <div class="panel-heading">
            <div>
              <p class="step-caption">관리자 운영 화면</p>
              <h2>${isDraft ? "새 연구 record 초안 입력" : "선택한 연구 record 편집"}</h2>
              <p class="step-description">
                ${isDraft
                  ? "문진만 먼저 입력해도 위험도 계산과 예측 요약이 즉시 생성됩니다. 이후 임상·센서 입력이 붙으면 같은 record가 더 정교해집니다."
                  : "문진 변경사항이 저장되면 같은 record의 예측 요약과 운영 우선순위가 함께 재계산됩니다."}
              </p>
            </div>
          </div>
          ${state.saveMessage ? `<div class="save-banner">${escapeHtml(state.saveMessage)}</div>` : ""}
          ${state.dbMessage ? `<div class="summary-banner">${escapeHtml(state.dbMessage)}</div>` : ""}
        </header>
        <div class="panel-body">
          ${renderPortfolioSection(portfolio)}
          ${renderPredictionSection(working, insights)}
          ${renderSummarySection(working, scores, isDraft)}
          ${renderBasicSection()}
          ${renderDiabetesSection()}
          ${renderHistorySection()}
          ${renderNeuropathySection()}
          ${renderIschemiaSection()}
          ${renderCurrentFootSection()}
          ${renderSelfCareSection()}
          ${renderFootwearSection()}
          ${renderComorbiditySection()}
          ${renderResearchSection()}
          <section class="sticky-footer">
            <p>${isDraft ? "저장하면 새 연구 record가 생성되고, 이후 임상·센서 페이지에서 같은 record에 측정값을 이어 붙일 수 있습니다." : "현재 문진 수정사항과 분석 요약을 같은 record에 반영합니다."}</p>
            <div class="button-row">
              <button class="secondary-button" data-action="reset-form">변경 취소</button>
              <button class="primary-button dark" data-action="save-questionnaire">${isDraft ? "새 record 저장" : "변경 저장"}</button>
            </div>
          </section>
        </div>
      </section>
    </main>
  `;
}

function renderLoginScreen() {
  const usesRemoteAuth = state.storageBackend.kind === "remote";

  return `
    <main class="completion-shell">
      <section class="completion-card">
        <div class="completion-hero">
          <p class="eyebrow">Admin Login</p>
          <h1>관리자 로그인 후 연구 DB를 운영할 수 있습니다.</h1>
          <p>${
            usesRemoteAuth
              ? "현재 이 페이지는 중앙 서버 인증에 연결되어 있습니다. Render 환경변수에 설정한 관리자 계정으로 로그인하면 중앙 DB를 바로 운영할 수 있습니다."
              : "이 데모는 GitHub Pages 같은 정적 환경을 전제로 하므로, 중앙 서버 인증 대신 브라우저 세션 기반 관리자 로그인과 JSON 백업/복원 흐름을 함께 제공합니다."
          }</p>
        </div>
        ${state.auth.error ? `<div class="alert-box danger top-gap">${escapeHtml(state.auth.error)}</div>` : ""}
        <section class="question-card top-gap">
          <div class="question-head">
            <h3>${usesRemoteAuth ? "서버 관리자 인증" : "데모 관리자 인증"}</h3>
            <span class="required-pill optional">${usesRemoteAuth ? "Central DB" : "Demo Only"}</span>
          </div>
          <div class="clinician-grid top-gap">
            ${fieldCard("관리자 ID", authField("username", state.auth.username, "text", "관리자 ID를 입력하세요"))}
            ${fieldCard("비밀번호", authField("password", state.auth.password, "password", "비밀번호를 입력하세요"))}
            ${fieldCard(
              usesRemoteAuth ? "현재 로그인 안내" : "데모 계정 안내",
              `
                ${
                  usesRemoteAuth
                    ? `
                      <p class="helper-text">현재는 GitHub Pages 화면이 Render API에 연결되어 있습니다.</p>
                      <p class="helper-text">Render Environment에 넣은 <strong>ADMIN_USERNAME</strong>, <strong>ADMIN_PASSWORD</strong> 값으로 로그인해 주세요.</p>
                      <p class="helper-text">중앙 DB 연결 상태: <strong>${escapeHtml(state.storageBackend.label)}</strong></p>
                    `
                    : `
                      <p class="helper-text">데모 ID: <strong>${escapeHtml(demoAdmin.username)}</strong></p>
                      <p class="helper-text">데모 비밀번호: <strong>${escapeHtml(demoAdmin.password)}</strong></p>
                      <p class="helper-text">주의: 이 로그인은 공개 데모용 프런트엔드 세션 보호입니다. 실서비스에서는 반드시 서버 인증과 중앙 DB가 필요합니다.</p>
                    `
                }
              `,
              "full-span",
            )}
          </div>
          <div class="button-row top-gap">
            <button class="primary-button dark" data-action="login-admin">관리자 로그인</button>
            <a class="secondary-button link-button" href="./index.html">환자 문진으로 이동</a>
          </div>
        </section>
      </section>
    </main>
  `;
}

function renderPortfolioSection(portfolio) {
  return `
    <section class="summary-card">
      <div class="summary-head">
        <div>
          <p class="step-caption">운영 대시보드</p>
          <h3>브라우저형 연구 DB 현황</h3>
        </div>
        <span class="badge soft">Static Demo Friendly</span>
      </div>
      <div class="summary-grid three">
        ${summaryItem("전체 record", String(portfolio.total))}
        ${summaryItem("고위험군", `${portfolio.highRiskCount}건`)}
        ${summaryItem("즉시 확인", `${portfolio.urgentCount}건`)}
        ${summaryItem("임상 입력 완료", `${portfolio.withClinicianCount}건`)}
        ${summaryItem("센서 입력 완료", `${portfolio.withSensorCount}건`)}
        ${summaryItem("추적 우선군", `${portfolio.followUpCount}건`)}
        ${summaryItem("Risk 0", `${portfolio.riskDistribution[0]}건`)}
        ${summaryItem("Risk 1", `${portfolio.riskDistribution[1]}건`)}
        ${summaryItem("Risk 2", `${portfolio.riskDistribution[2]}건`)}
        ${summaryItem("Risk 3", `${portfolio.riskDistribution[3]}건`)}
        ${summaryItem("평균 종합점수", `${portfolio.averageOverallScore}점`)}
        ${summaryItem("관리 단계", portfolio.stageLabel)}
      </div>
      <div class="clinician-grid top-gap">
        ${fieldCard(
          "우선 검토 대상",
          portfolio.priorityRecords.length
            ? `<ul class="simple-list">${portfolio.priorityRecords
                .map(
                  (item) =>
                    `<li><strong>${escapeHtml(item.record.recordId)}</strong> - ${escapeHtml(item.record.patientSummary?.nameMasked ?? "미입력")} / ${escapeHtml(item.insights.predictionSummary.overallLevel)} / ${item.insights.predictionSummary.overallScore}점</li>`,
                )
                .join("")}</ul>`
            : `<p class="helper-text">아직 저장된 record가 없습니다. 환자 문진 또는 관리자 초안 입력으로 첫 record를 생성해 주세요.</p>`,
          "full-span",
        )}
      </div>
    </section>
  `;
}

function renderPredictionSection(record, insights) {
  const summary = insights.predictionSummary;
  const endpoints = insights.predictionEndpoints;

  return `
    <section class="summary-card">
      <div class="summary-head">
        <div>
          <p class="step-caption">예측/분석 요약</p>
          <h3>${escapeHtml(summary.careStage)}</h3>
        </div>
        <span class="badge warm">${escapeHtml(summary.overallLevel)} ${summary.overallScore}점</span>
      </div>
      <div class="summary-grid three">
        ${summaryItem("종합 예측", `${summary.overallLevel} · ${summary.overallScore}점`)}
        ${summaryItem("문진 완성도", `${summary.dataCompleteness.questionnairePercent}%`)}
        ${summaryItem("임상 완성도", `${summary.dataCompleteness.clinicianPercent}%`)}
        ${summaryItem("센서 완성도", `${summary.dataCompleteness.sensorPercent}%`)}
        ${summaryItem("6개월 신규 궤양", formatEndpoint(endpoints.primary_6m_new_ulcer))}
        ${summaryItem("6개월 재발 궤양", formatEndpoint(endpoints.primary_6m_recurrent_ulcer))}
        ${summaryItem("지속성 hotspot", formatEndpoint(endpoints.secondary_persistent_hotspot))}
        ${summaryItem("상처 악화", formatEndpoint(endpoints.secondary_wound_worsening))}
        ${summaryItem("혈관 평가 의뢰", formatEndpoint(endpoints.secondary_vascular_referral_needed))}
        ${summaryItem("압력 분산 실패", formatEndpoint(endpoints.secondary_offloading_failure))}
        ${summaryItem("고위험군 전환", formatEndpoint(endpoints.secondary_clinician_confirmed_high_risk_transition))}
        ${summaryItem("활동성 증상", record.questionnairePayload.internalFlags.active_concerning_foot_symptom ? "있음" : "없음")}
      </div>
      <div class="clinician-grid top-gap">
        ${fieldCard("우선 확인 포인트", renderList(summary.urgentAlerts.length ? summary.urgentAlerts : summary.topDrivers))}
        ${fieldCard("권장 다음 조치", renderList(summary.recommendedActions))}
        ${fieldCard("예측 설명", `<p class="helper-text">${escapeHtml(summary.narrative)}</p>`, "full-span")}
      </div>
    </section>
  `;
}

function renderSummarySection(working, scores, isDraft) {
  return `
    <section class="summary-card">
      <div class="summary-head">
        <div>
          <p class="step-caption">연구 record</p>
          <h3>${escapeHtml(working.recordId)}</h3>
        </div>
        <div class="button-row">
          ${isDraft ? '<span class="badge soft">Draft</span>' : '<button class="secondary-button small danger-button" data-action="delete-record">Delete</button>'}
          <button class="secondary-button small" data-action="export-record">JSON 내보내기</button>
        </div>
      </div>
      <div class="summary-grid three">
        ${summaryItem("제출 시각", formatDateTime(working.questionnairePayload.submittedAt))}
        ${summaryItem("환자 이름", state.form.demographics.fullName || "미입력")}
        ${summaryItem("휴대폰 번호", formatPhoneNumber(state.form.demographics.phoneNumber))}
        ${summaryItem("이메일", state.form.demographics.emailAddress || "미입력")}
        ${summaryItem("성별/연령", `${labelFor(OPTIONS.gender, state.form.demographics.gender)} · ${numericText(state.form.demographics.age, "세")}`)}
        ${summaryItem("App Risk", `Risk ${scores.app_risk_class}`)}
        ${summaryItem("History Score", String(scores.history_score))}
        ${summaryItem("Neuropathy Score", String(scores.neuropathy_score))}
        ${summaryItem("Ischemia Score", String(scores.ischemia_score))}
        ${summaryItem("Foot Status Score", String(scores.foot_status_score))}
        ${summaryItem("행동 점수", String(scores.behavior_score))}
        ${summaryItem("신발 점수", String(scores.footwear_score))}
      </div>
    </section>
  `;
}

function renderRecordChip(record) {
  const selected = record.recordId === state.selectedRecordId;
  const insights = getRecordInsights(record);

  return `
    <button class="record-chip ${selected ? "selected" : ""}" data-action="select-record" data-record-id="${record.recordId}">
      <strong>${escapeHtml(record.recordId)}</strong>
      <span>${escapeHtml(record.patientSummary.nameMasked ?? "미입력")} · ${escapeHtml(record.patientSummary.phoneMasked ?? "미입력")}</span>
      <span>${escapeHtml(record.patientSummary.sex)} · ${escapeHtml(String(record.patientSummary.age))}세 · App Risk ${escapeHtml(String(record.patientSummary.appRiskClass))}</span>
      <span>${escapeHtml(insights.predictionSummary.overallLevel)} · ${insights.predictionSummary.overallScore}점 · ${formatDateTime(record.updatedAt)}</span>
    </button>
  `;
}

function renderEmptyRecordList() {
  return `
    <div class="empty-card">
      <strong>저장된 연구 record가 없습니다.</strong>
      <p>환자 문진, 관리자 초안 입력, 또는 JSON 가져오기로 연구 DB를 시작할 수 있습니다.</p>
    </div>
  `;
}

function renderBasicSection() {
  return renderSectionCard("기본정보", `
    ${fieldCard("환자 이름", textField("demographics", "fullName", state.form.demographics.fullName, "text", "예: 홍길동"))}
    ${fieldCard("휴대폰 번호", textField("demographics", "phoneNumber", state.form.demographics.phoneNumber, "tel", "예: 01012345678"))}
    ${fieldCard("이메일", textField("demographics", "emailAddress", state.form.demographics.emailAddress, "email", "예: wiregene@example.com"))}
    ${fieldCard("성별", selectField("demographics", "gender", state.form.demographics.gender, OPTIONS.gender))}
    ${fieldCard("연령", textField("demographics", "age", state.form.demographics.age, "number", "예: 68"))}
    ${fieldCard("키(cm)", textField("demographics", "heightCm", state.form.demographics.heightCm, "number", "예: 163"))}
    ${fieldCard("몸무게(kg)", textField("demographics", "weightKg", state.form.demographics.weightKg, "number", "예: 61"))}
  `);
}

function renderDiabetesSection() {
  const d = state.form.diabetes;
  return renderSectionCard("당뇨 정보", `
    ${fieldCard("당뇨 진단 기간", selectField("diabetes", "diagnosisDuration", d.diagnosisDuration, OPTIONS.diagnosisDuration))}
    ${fieldCard("현재 치료", selectField("diabetes", "treatmentType", d.treatmentType, OPTIONS.treatmentType))}
    ${fieldCard("최근 혈당/HbA1c 인지", selectField("diabetes", "knowsRecentGlucoseOrHbA1c", d.knowsRecentGlucoseOrHbA1c, OPTIONS.yesNo))}
    ${fieldCard("HbA1c 입력 방식", selectField("diabetes", "hbA1cMode", d.hbA1cMode, OPTIONS.hbA1cMode))}
    ${fieldCard("HbA1c", textField("diabetes", "hbA1c", d.hbA1c, "number", "예: 7.2"), "full-span")}
  `);
}

function renderHistorySection() {
  const h = state.form.history;
  return renderSectionCard("과거 발 병력", `
    ${fieldCard("과거 궤양", selectField("history", "ulcerHistory", h.ulcerHistory, OPTIONS.yesNoUnknown))}
    ${fieldCard("과거 절단", selectField("history", "amputationHistory", h.amputationHistory, OPTIONS.yesNo))}
    ${fieldCard("입원/시술/수술", selectField("history", "admissionOrProcedureHistory", h.admissionOrProcedureHistory, OPTIONS.yesNoUnknown))}
    ${fieldCard("의사 진단 이력", multiSelectField(h.diagnosedConditions), "full-span")}
  `);
}

function renderNeuropathySection() {
  const n = state.form.neuropathy;
  return renderSectionCard("신경병증 증상", `
    ${fieldCard("발 저림", selectField("neuropathy", "numbness", n.numbness, OPTIONS.frequency4))}
    ${fieldCard("발바닥 감각 저하", selectField("neuropathy", "reducedSoleSensation", n.reducedSoleSensation, OPTIONS.frequency4))}
    ${fieldCard("화끈거림", selectField("neuropathy", "burning", n.burning, OPTIONS.frequency4))}
    ${fieldCard("야간 통증", selectField("neuropathy", "nightPain", n.nightPain, OPTIONS.nightPain))}
    ${fieldCard("온도 감각 저하", selectField("neuropathy", "temperatureLoss", n.temperatureLoss, OPTIONS.yesNoUnknown))}
  `);
}

function renderIschemiaSection() {
  const i = state.form.ischemia;
  return renderSectionCard("혈액순환 증상", `
    ${fieldCard("걸을 때 통증, 쉬면 호전", selectField("ischemia", "walkingPainRelievedByRest", i.walkingPainRelievedByRest, OPTIONS.yesNoUnknown))}
    ${fieldCard("휴식 시 통증", selectField("ischemia", "restPain", i.restPain, OPTIONS.threeLevel))}
    ${fieldCard("발이 차가움", selectField("ischemia", "coldFeet", i.coldFeet, OPTIONS.threeLevel))}
    ${fieldCard("상처 치유 지연", selectField("ischemia", "slowHealing", i.slowHealing, OPTIONS.yesNoUnknown))}
    ${fieldCard("혈액순환 질환 진단", selectField("ischemia", "circulationDiagnosis", i.circulationDiagnosis, OPTIONS.yesNoUnknown))}
  `);
}

function renderCurrentFootSection() {
  const c = state.form.currentFoot;
  return renderSectionCard("현재 발 상태", `
    ${fieldCard("상처", selectField("currentFoot", "wound", c.wound, OPTIONS.presentAbsentUnknown))}
    ${fieldCard("발적", selectField("currentFoot", "redness", c.redness, OPTIONS.presentAbsentUnknown))}
    ${fieldCard("부종/열감", selectField("currentFoot", "swellingOrHeat", c.swellingOrHeat, OPTIONS.presentAbsentUnknown))}
    ${fieldCard("굳은살/갈라짐/물집", selectField("currentFoot", "callusCrackBlister", c.callusCrackBlister, OPTIONS.presentAbsentUnknown))}
    ${fieldCard("발톱/발모양 변화", selectField("currentFoot", "nailOrShapeDeformity", c.nailOrShapeDeformity, OPTIONS.presentAbsentUnknown))}
  `);
}

function renderSelfCareSection() {
  const s = state.form.selfCare;
  return renderSectionCard("발 관리 습관", `
    ${fieldCard("매일 발 확인", selectField("selfCare", "dailyCheck", s.dailyCheck, OPTIONS.footCheck))}
    ${fieldCard("발가락 사이 건조", selectField("selfCare", "dryBetweenToes", s.dryBetweenToes, OPTIONS.care))}
    ${fieldCard("상처 발생 시 빠른 대처", selectField("selfCare", "earlyActionForWounds", s.earlyActionForWounds, OPTIONS.care))}
    ${fieldCard("맨발 보행", selectField("selfCare", "walksBarefoot", s.walksBarefoot, OPTIONS.barefoot))}
  `);
}

function renderFootwearSection() {
  const f = state.form.footwear;
  return renderSectionCard("신발/보행 습관", `
    ${fieldCard("꽉 끼는 신발", selectField("footwear", "tightShoes", f.tightShoes, OPTIONS.tightShoes))}
    ${fieldCard("새 신발 상처 경험", selectField("footwear", "newShoeInjury", f.newShoeInjury, OPTIONS.yesNo))}
    ${fieldCard("하루 평균 걷기", selectField("footwear", "walkingTime", f.walkingTime, OPTIONS.walkingTime))}
    ${fieldCard("보행 불균형", selectField("footwear", "gaitImbalance", f.gaitImbalance, OPTIONS.yesNoUnknown))}
  `);
}

function renderComorbiditySection() {
  const c = state.form.comorbidity;
  return renderSectionCard("동반질환", `
    ${fieldCard("흡연 상태", selectField("comorbidity", "smokingStatus", c.smokingStatus, OPTIONS.smoking))}
    ${fieldCard("신장질환/투석", selectField("comorbidity", "kidneyDiseaseOrDialysis", c.kidneyDiseaseOrDialysis, OPTIONS.yesNoUnknown))}
    ${fieldCard("시야 문제", selectField("comorbidity", "visionDifficulty", c.visionDifficulty, OPTIONS.yesNo))}
    ${fieldCard("자가 발 관리 어려움", selectField("comorbidity", "selfCareDifficulty", c.selfCareDifficulty, OPTIONS.yesNo))}
  `);
}

function renderResearchSection() {
  const r = state.form.research;
  return renderSectionCard("추가 연구 참여", `
    ${fieldCard("발 사진 동의", selectField("research", "photoConsent", r.photoConsent, OPTIONS.yesNo))}
    ${fieldCard("센서 연구 참여", selectField("research", "sensorStudyInterest", r.sensorStudyInterest, OPTIONS.sensorStudy))}
    ${fieldCard("추적 문진 동의", selectField("research", "followUpConsent", r.followUpConsent, OPTIONS.yesNo))}
  `);
}

function renderSectionCard(title, content) {
  return `
    <section class="question-card">
      <div class="question-head">
        <h3>${escapeHtml(title)}</h3>
        <span class="required-pill optional">관리자 수정 가능</span>
      </div>
      <div class="clinician-grid top-gap">${content}</div>
    </section>
  `;
}

function fieldCard(title, body, extraClass = "") {
  return `<article class="field-card ${extraClass}"><strong>${escapeHtml(title)}</strong><div class="top-gap">${body}</div></article>`;
}

function textField(section, field, value, type, placeholder) {
  return `
    <label class="text-field">
      <input
        type="${type}"
        data-section="${section}"
        data-field="${field}"
        value="${escapeAttribute(value ?? "")}"
        placeholder="${escapeAttribute(placeholder)}"
      />
    </label>
  `;
}

function authField(field, value, type, placeholder) {
  return `
    <label class="text-field">
      <input
        type="${type}"
        data-auth-field="${field}"
        value="${escapeAttribute(value ?? "")}"
        placeholder="${escapeAttribute(placeholder)}"
      />
    </label>
  `;
}

function selectField(section, field, value, options) {
  return `
    <label class="select-field">
      <select data-section="${section}" data-field="${field}">
        <option value="">선택해 주세요</option>
        ${options
          .map(
            (option) =>
              `<option value="${escapeAttribute(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
          )
          .join("")}
      </select>
    </label>
  `;
}

function multiSelectField(selectedValues) {
  return `
    <div class="choice-grid cols-2">
      ${OPTIONS.diagnosedConditions
        .map(
          (option) => `
            <button class="choice-button ${selectedValues.includes(option.value) ? "selected warm" : ""}" data-action="toggle-condition" data-value="${option.value}">
              <strong>${escapeHtml(option.label)}</strong>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderList(items) {
  if (!items.length) {
    return `<p class="helper-text">추가로 입력된 이상 신호가 아직 충분하지 않습니다.</p>`;
  }

  return `<ul class="simple-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function summaryItem(label, value) {
  return `
    <article class="summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function formatEndpoint(endpoint) {
  return `${endpoint.level} · ${endpoint.score}점`;
}

function buildPortfolioMetrics(records) {
  const enriched = records.map((record) => ({
    record,
    insights: getRecordInsights(record),
  }));
  const total = enriched.length;
  const highRiskCount = enriched.filter((item) => item.record.patientSummary.appRiskClass >= 2).length;
  const urgentCount = enriched.filter(
    (item) =>
      item.record.patientSummary.activeConcern ||
      item.insights.predictionSummary.overallLevel === "매우 높음",
  ).length;
  const withClinicianCount = enriched.filter((item) => hasClinicianInput(item.record)).length;
  const withSensorCount = enriched.filter((item) => hasSensorInput(item.record)).length;
  const followUpCount = enriched.filter(
    (item) =>
      item.insights.predictionEndpoints.primary_6m_new_ulcer.score >= 55 ||
      item.insights.predictionEndpoints.primary_6m_recurrent_ulcer.score >= 55,
  ).length;
  const riskDistribution = [0, 1, 2, 3].map(
    (riskClass) => enriched.filter((item) => item.record.patientSummary.appRiskClass === riskClass).length,
  );
  const averageOverallScore = total
    ? Math.round(
        enriched.reduce((sum, item) => sum + item.insights.predictionSummary.overallScore, 0) / total,
      )
    : 0;

  return {
    total,
    highRiskCount,
    urgentCount,
    withClinicianCount,
    withSensorCount,
    followUpCount,
    riskDistribution,
    averageOverallScore,
    stageLabel:
      withSensorCount > 0
        ? "센서 융합 시연 가능"
        : withClinicianCount > 0
          ? "문진 + 임상 시연 가능"
          : "문진 중심 시연 단계",
    priorityRecords: enriched
      .sort(
        (left, right) =>
          right.insights.predictionSummary.overallScore - left.insights.predictionSummary.overallScore,
      )
      .slice(0, 3),
  };
}

function getRecordInsights(record) {
  if (record.predictionSummary && record.predictionEndpoints) {
    return {
      predictionSummary: record.predictionSummary,
      predictionEndpoints: record.predictionEndpoints,
    };
  }

  return buildResearchInsights({
    questionnairePayload: record.questionnairePayload,
    staticFeatures: record.aiFeatureGroups?.static,
    clinicianMeasurements: record.clinicianMeasurements,
    longitudinalFeatures: record.aiFeatureGroups?.timeSeries,
    sensorFeatureBundle: record.aiFeatureGroups?.sensor,
    ruleFusionSignals: record.ruleFusionSignals,
    ruleFusionFlags: record.ruleFusionFlags,
  });
}

function hasClinicianInput(record) {
  return Object.values(record.clinicianMeasurements ?? {}).some((value) => value !== null);
}

function hasSensorInput(record) {
  const timeSeries = Object.values(record.aiFeatureGroups?.timeSeries ?? {});
  const sensorValues = Object.values(record.aiFeatureGroups?.sensor ?? {}).flatMap((group) =>
    Object.values(group),
  );
  return [...timeSeries, ...sensorValues].some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== null,
  );
}

function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label ?? "미입력";
}

function numericText(value, unit) {
  return value ? `${value}${unit}` : "미입력";
}

function formatPhoneNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return value || "미입력";
}

function formatDateTime(value) {
  if (!value) {
    return "미입력";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
