import {
  buildCombinedResearchRecord,
  createInitialClinicianMeasurements,
  createInitialQuestionnaireAnswers,
} from "./models.mjs";
import {
  exportResearchRecord,
  listSavedResearchRecords,
  saveNewResearchRecord,
  updateSavedResearchRecord,
} from "./storage.mjs";
import {
  isDemoAdminAuthenticated,
  renderAdminSessionRequired,
  syncAdminSession,
} from "./auth.mjs";

const root = document.querySelector("#app");

const BOOLEAN_OPTIONS = [
  { value: "TRUE", label: "예" },
  { value: "FALSE", label: "아니오" },
  { value: "NULL", label: "미입력" },
];

const RISK_OPTIONS = [
  { value: "0", label: "Risk 0" },
  { value: "1", label: "Risk 1" },
  { value: "2", label: "Risk 2" },
  { value: "3", label: "Risk 3" },
  { value: "NULL", label: "미정" },
];

const state = {
  records: [],
  selectedRecordId: null,
  form: createInitialClinicianMeasurements(),
  saveMessage: "",
};

render();
initialize();

root.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (!(await ensureAdminSession())) {
    render();
    return;
  }

  const { action } = target.dataset;

  if (action === "refresh-records") {
    await refreshRecords();
  } else if (action === "select-record") {
    state.selectedRecordId = target.dataset.recordId;
    syncFormWithSelection();
  } else if (action === "set-boolean") {
    state.form[target.dataset.field] = parseBooleanValue(target.dataset.value);
    state.saveMessage = "";
  } else if (action === "set-risk") {
    state.form.iwgdf_confirmed_risk_class =
      target.dataset.value === "NULL" ? null : Number(target.dataset.value);
    state.saveMessage = "";
  } else if (action === "save-clinical") {
    await saveClinical();
  } else if (action === "export-record") {
    exportResearchRecord(getWorkingRecord());
  }

  render();
});

root.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!isDemoAdminAuthenticated()) {
    return;
  }
  const field = target.dataset.field;
  if (!field) return;
  state.form[field] = target.value === "" ? null : Number(target.value);
  state.saveMessage = "";
});

async function initialize() {
  await syncAdminSession({
    force: true,
  });
  if (isDemoAdminAuthenticated()) {
    await refreshRecords();
  }
  render();
}

async function ensureAdminSession() {
  if (isDemoAdminAuthenticated()) {
    return true;
  }

  const session = await syncAdminSession({
    force: true,
  });
  return Boolean(session);
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
      await syncAdminSession({
        force: true,
      });
      state.records = [];
      state.selectedRecordId = null;
      syncFormWithSelection();
      return;
    }

    throw error;
  }
}

function syncFormWithSelection() {
  const selected = getSelectedRecord();
  state.form = selected
    ? structuredClone(selected.clinicianMeasurements ?? createInitialClinicianMeasurements())
    : createInitialClinicianMeasurements();
  state.saveMessage = "";
}

function getSelectedRecord() {
  if (!state.selectedRecordId) return null;
  return state.records.find((record) => record.recordId === state.selectedRecordId) ?? null;
}

function getWorkingRecord() {
  return getSelectedRecord() ?? createDraftRecord();
}

function createDraftRecord() {
  const combined = buildCombinedResearchRecord({
    questionnaireAnswers: createInitialQuestionnaireAnswers(),
    clinicianMeasurements: structuredClone(state.form),
  });
  const now = combined.questionnairePayload.submittedAt;
  return {
    ...combined,
    recordId: "DEMO-CLINICIAN-DRAFT",
    createdAt: now,
    updatedAt: now,
    patientSummary: {
      submittedAt: now,
      sex: "미입력",
      age: "미입력",
      appRiskClass: combined.questionnairePayload.internalScores.app_risk_class,
      activeConcern: combined.questionnairePayload.internalFlags.active_concerning_foot_symptom,
    },
  };
}

async function saveClinical() {
  const selected = getSelectedRecord();
  if (!selected) {
    const saved = await saveNewResearchRecord(
      buildCombinedResearchRecord({
        questionnaireAnswers: createInitialQuestionnaireAnswers(),
        clinicianMeasurements: structuredClone(state.form),
      }),
    );
    state.selectedRecordId = saved.recordId;
    await refreshRecords();
    state.saveMessage = "데모 의사용 측정 레코드가 저장되었습니다.";
    return;
  }

  const updated = buildCombinedResearchRecord({
    questionnaireAnswers: structuredClone(selected.questionnairePayload.questionnaireData),
    clinicianMeasurements: structuredClone(state.form),
    longitudinalFeatures: structuredClone(selected.aiFeatureGroups.timeSeries),
    sensorFeatureBundle: structuredClone(selected.aiFeatureGroups.sensor),
    ruleFusionSignals: structuredClone(selected.ruleFusionSignals),
  });

  const saved = await updateSavedResearchRecord(selected.recordId, updated);
  if (saved) {
    await refreshRecords();
    state.saveMessage = "의사용 측정값이 저장되었습니다.";
  }
}

function render() {
  if (!isDemoAdminAuthenticated()) {
    root.innerHTML = renderAdminSessionRequired({
      title: "임상 측정 입력은 관리자 로그인 후 사용할 수 있습니다.",
      description:
        "관리자 페이지에서 로그인한 같은 브라우저 세션에서만 임상 측정값을 연구 DB에 연결할 수 있습니다.",
    });
    return;
  }

  const selected = getSelectedRecord();
  const working = getWorkingRecord();
  const isDraft = !selected;
  const staticFeatures = working.aiFeatureGroups.static;
  const demographics = working.questionnairePayload.questionnaireData.demographics;

  root.innerHTML = `
    <main class="app-shell">
      <aside class="side-panel">
        <section class="hero-card">
          <p class="eyebrow">Clinician Demo</p>
          <h1>의사용 측정 입력</h1>
          <p>저장된 환자 문진이 없어도 데모용 임상 측정 항목을 바로 입력할 수 있습니다.</p>
        </section>
        <section class="progress-card">
          <p class="eyebrow tint">저장된 레코드</p>
          <p class="metric-value">${state.records.length}</p>
          <div class="button-row compact top-gap">
            <button class="secondary-button small" data-action="refresh-records">목록 새로고침</button>
            <a class="secondary-button small link-button" href="./admin.html">관리자 페이지</a>
            <a class="secondary-button small link-button" href="./sensor.html">센서 입력</a>
            <a class="secondary-button small link-button" href="./index.html">환자 문진</a>
          </div>
        </section>
        <div class="record-list">
          ${state.records.length ? state.records.map(renderRecordChip).join("") : renderEmptyRecordList()}
        </div>
      </aside>
      <section class="main-panel">
        <header class="panel-header">
          <div class="header-top-row">
            <div class="badge-row">
              <span class="badge">Clinician Data</span>
              <span class="badge soft">${isDraft ? "Demo Draft" : "Saved Record"}</span>
            </div>
            <div class="top-copyright">Copyright 2026 Wiregene Co., Ltd.</div>
          </div>
          <div class="panel-heading">
            <div>
              <p class="step-caption">의사용 측정 화면</p>
              <h2>${isDraft ? "데모 의사 측정 입력" : "임상 측정값 입력"}</h2>
              <p class="step-description">
                ${isDraft ? "초안 상태로 바로 입력하고 데모 레코드로 저장할 수 있습니다." : "선택한 환자 레코드에 임상 측정값을 기록합니다."}
              </p>
            </div>
          </div>
          ${state.saveMessage ? `<div class="save-banner">${escapeHtml(state.saveMessage)}</div>` : ""}
        </header>
        <div class="panel-body">
          <section class="summary-card">
            <div class="summary-head">
              <div>
                <p class="step-caption">연구 레코드</p>
                <h3>${escapeHtml(working.recordId)}</h3>
              </div>
              <div class="button-row">
                ${isDraft ? '<span class="badge soft">Demo Draft</span>' : ""}
                <button class="secondary-button small" data-action="export-record">JSON 내보내기</button>
              </div>
            </div>
            <div class="summary-grid three">
              ${summaryItem("제출 시각", formatDateTime(working.patientSummary.submittedAt))}
              ${summaryItem("환자 이름", demographics.fullName || "미입력")}
              ${summaryItem("휴대폰 번호", formatPhoneNumber(demographics.phoneNumber))}
              ${summaryItem("이메일", demographics.emailAddress || "미입력")}
              ${summaryItem("환자 요약", `${working.patientSummary.sex} · ${working.patientSummary.age}세`)}
              ${summaryItem("문진 Risk", `App Risk ${working.patientSummary.appRiskClass}`)}
              ${summaryItem("History Score", String(staticFeatures.history_score))}
              ${summaryItem("Neuropathy Score", String(staticFeatures.neuropathy_score))}
              ${summaryItem("Confirmed Risk", state.form.iwgdf_confirmed_risk_class === null ? "미정" : `Risk ${state.form.iwgdf_confirmed_risk_class}`)}
            </div>
          </section>

          <section class="question-card">
            <div class="question-head">
              <h3>임상 측정값 입력</h3>
              <span class="required-pill required">의사 기록</span>
            </div>
            <div class="clinician-grid">
              ${booleanField("10 g monofilament 이상", "monofilament_abnormal", state.form.monofilament_abnormal)}
              ${numberField("Pulse absent count", "pulse_absent_count", state.form.pulse_absent_count, "0~4", "1")}
              ${numberField("TBI", "tbi_value", state.form.tbi_value, "예: 0.62", "0.01")}
              ${numberField("Toe pressure", "toe_pressure_value", state.form.toe_pressure_value, "mmHg", "0.1")}
              ${numberField("TcPO2", "tcpo2_value", state.form.tcpo2_value, "mmHg", "0.1")}
              ${booleanField("Deformity present", "deformity_present", state.form.deformity_present)}
              ${booleanField("Active wound present", "active_wound_present", state.form.active_wound_present)}
              ${booleanField("Clinician redness", "clinician_redness", state.form.clinician_redness)}
              ${booleanField("Clinician callus", "clinician_callus", state.form.clinician_callus)}
              ${booleanField("Clinician edema", "clinician_edema", state.form.clinician_edema)}
              ${booleanField("Clinician infection suspect", "clinician_infection_suspect", state.form.clinician_infection_suspect)}
              ${riskField(state.form.iwgdf_confirmed_risk_class)}
            </div>
            <div class="button-row top-gap">
              <button class="primary-button dark" data-action="save-clinical">${isDraft ? "데모 레코드 저장" : "측정값 저장"}</button>
              <a class="secondary-button link-button" href="./sensor.html">센서 결과 입력</a>
            </div>
          </section>
        </div>
      </section>
    </main>
  `;
}

function renderRecordChip(record) {
  const selected = record.recordId === state.selectedRecordId;
  return `
    <button class="record-chip ${selected ? "selected" : ""}" data-action="select-record" data-record-id="${record.recordId}">
      <strong>${escapeHtml(record.recordId)}</strong>
      <span>${escapeHtml(record.patientSummary.nameMasked ?? "미입력")} · ${escapeHtml(record.patientSummary.phoneMasked ?? "미입력")}</span>
      <span>${escapeHtml(record.patientSummary.sex)} · ${escapeHtml(String(record.patientSummary.age))}세 · App Risk ${record.patientSummary.appRiskClass}</span>
      <span>${formatDateTime(record.patientSummary.submittedAt)}</span>
    </button>
  `;
}

function renderEmptyRecordList() {
  return `
    <div class="empty-card">
      <strong>저장된 환자 문진이 없습니다.</strong>
      <p>오른쪽에서 데모 의사용 측정 폼을 바로 입력할 수 있습니다.</p>
    </div>
  `;
}

function booleanField(title, field, currentValue) {
  return `
    <article class="field-card">
      <strong>${escapeHtml(title)}</strong>
      <div class="choice-grid cols-3 top-gap">
        ${BOOLEAN_OPTIONS.map(
          (option) => `
            <button class="choice-button ${isBooleanSelected(currentValue, option.value) ? "selected" : ""}" data-action="set-boolean" data-field="${field}" data-value="${option.value}">
              <strong>${escapeHtml(option.label)}</strong>
            </button>
          `,
        ).join("")}
      </div>
    </article>
  `;
}

function riskField(currentValue) {
  return `
    <article class="field-card">
      <strong>IWGDF Confirmed Risk</strong>
      <div class="choice-grid cols-3 top-gap">
        ${RISK_OPTIONS.map(
          (option) => `
            <button class="choice-button ${isRiskSelected(currentValue, option.value) ? "selected warm" : ""}" data-action="set-risk" data-value="${option.value}">
              <strong>${escapeHtml(option.label)}</strong>
            </button>
          `,
        ).join("")}
      </div>
    </article>
  `;
}

function numberField(title, field, value, placeholder, step) {
  return `
    <article class="field-card">
      <strong>${escapeHtml(title)}</strong>
      <label class="number-field top-gap">
        <input
          type="number"
          inputmode="decimal"
          step="${step}"
          data-field="${field}"
          value="${escapeAttribute(value ?? "")}"
          placeholder="${escapeAttribute(placeholder)}"
        />
        <span>입력</span>
      </label>
    </article>
  `;
}

function parseBooleanValue(value) {
  if (value === "TRUE") return true;
  if (value === "FALSE") return false;
  return null;
}

function isBooleanSelected(currentValue, optionValue) {
  if (optionValue === "TRUE") return currentValue === true;
  if (optionValue === "FALSE") return currentValue === false;
  return currentValue === null;
}

function isRiskSelected(currentValue, optionValue) {
  if (optionValue === "NULL") return currentValue === null;
  return currentValue === Number(optionValue);
}

function summaryItem(label, value) {
  return `
    <article class="summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function formatPhoneNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return value || "미입력";
}

function formatDateTime(value) {
  if (!value) return "미입력";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
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
