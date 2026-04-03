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
  if (!target) {
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
    await saveClinicalMeasurements();
  } else if (action === "export-record") {
    const record = getDisplayRecord();
    if (record) {
      exportResearchRecord(record);
    }
  }

  render();
});

root.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const field = target.dataset.field;
  if (!field) {
    return;
  }

  state.form[field] = target.value === "" ? null : Number(target.value);
  state.saveMessage = "";
});

async function initialize() {
  await refreshRecords();
  render();
}

async function refreshRecords() {
  state.records = await listSavedResearchRecords();
  if (!state.selectedRecordId || !state.records.some((record) => record.recordId === state.selectedRecordId)) {
    state.selectedRecordId = state.records[0]?.recordId ?? null;
  }
  syncFormWithSelection();
}

function syncFormWithSelection() {
  const selected = getSelectedRecord();
  state.form = selected
    ? structuredClone(selected.clinicianMeasurements ?? createInitialClinicianMeasurements())
    : createInitialClinicianMeasurements();
  state.saveMessage = "";
}

function getSelectedRecord() {
  if (!state.selectedRecordId) {
    return null;
  }
  return state.records.find((record) => record.recordId === state.selectedRecordId) ?? null;
}

function getDisplayRecord() {
  return getSelectedRecord() ?? createDraftClinicalRecord();
}

function createDraftClinicalRecord() {
  const combined = buildCombinedResearchRecord({
    questionnaireAnswers: createInitialQuestionnaireAnswers(),
    clinicianMeasurements: structuredClone(state.form),
  });
  const now = combined.questionnairePayload.submittedAt ?? new Date().toISOString();

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

async function saveClinicalMeasurements() {
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
    state.saveMessage = "데모 의사 측정 레코드가 새로 저장되었습니다.";
    return;
  }

  const updated = structuredClone(selected);
  updated.clinicianMeasurements = structuredClone(state.form);
  updated.aiFeatureGroups.clinical = structuredClone(state.form);

  const saved = await updateSavedResearchRecord(selected.recordId, updated);
  if (saved) {
    state.saveMessage = "의사 측정값이 저장되었습니다.";
    await refreshRecords();
  }
}

function render() {
  const selected = getSelectedRecord();
  const displayRecord = getDisplayRecord();
  const isDraft = !selected;
  root.innerHTML = `
    <main class="app-shell">
      <aside class="side-panel">
        <section class="hero-card">
          <p class="eyebrow">Clinician Console</p>
          <h1>담당 의사 측정 입력</h1>
          <p>환자 문진은 별도로 수집되고, 이 화면에서는 측정값만 해당 연구 레코드에 기록합니다.</p>
        </section>
        <section class="progress-card">
          <p class="eyebrow tint">저장된 레코드</p>
          <p class="metric-value">${state.records.length}</p>
          <div class="button-row compact top-gap">
            <button class="secondary-button small" data-action="refresh-records">목록 새로고침</button>
            <a class="secondary-button small link-button" href="./sensor.html">센서 입력 화면</a>
            <a class="secondary-button small link-button" href="./admin.html">관리자 페이지</a>
            <a class="secondary-button small link-button" href="./index.html">환자 문진 열기</a>
          </div>
        </section>
        <div class="record-list">
          ${state.records.length ? state.records.map(renderRecordListItem).join("") : renderEmptyRecordList()}
        </div>
      </aside>
      <section class="main-panel">
        <header class="panel-header">
          <div class="header-top-row">
            <div class="badge-row">
              <span class="badge">Clinician Data</span>
              <span class="badge soft">Patient Questionnaire Separated</span>
            </div>
            <div class="top-copyright">Copyright 2026 Wiregene Co., Ltd.</div>
          </div>
          <div class="panel-heading">
            <div>
              <p class="step-caption">의사용 측정 화면</p>
              <h2>${selected ? "임상 측정값 입력" : "데모 의사 측정 입력"}</h2>
              <p class="step-description">
                ${
                  selected
                    ? "저장된 환자 문진 레코드를 선택하고 monofilament, pulse, TBI, toe pressure, TcPO2, 변형 여부 등을 기록합니다."
                    : "저장된 환자 문진이 없어도 데모 측정 폼을 바로 입력할 수 있습니다. 저장하면 이 브라우저에 데모 레코드가 생성됩니다."
                }
              </p>
            </div>
          </div>
          ${state.saveMessage ? `<div class="save-banner">${escapeHtml(state.saveMessage)}</div>` : ""}
        </header>
        <div class="panel-body">${renderSelectedRecord(displayRecord, isDraft)}</div>
      </section>
    </main>
  `;
}

function renderRecordListItem(record) {
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
      <p>오른쪽에서 데모 측정 폼을 바로 입력할 수 있습니다. 저장하면 이 브라우저에 데모 레코드가 생성됩니다.</p>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <section class="empty-card large">
      <strong>선택된 레코드가 없습니다.</strong>
      <p>환자 문진을 먼저 완료한 뒤 이 화면을 다시 열어 주세요.</p>
    </section>
  `;
}

function renderSelectedRecord(record, isDraft = false) {
  const staticFeatures = record.aiFeatureGroups.static;
  const demographics = record.questionnairePayload?.questionnaireData?.demographics ?? {};
  return `
    <section class="summary-card">
      <div class="summary-head">
        <div>
          <p class="step-caption">연구 레코드</p>
          <h3>${escapeHtml(record.recordId)}</h3>
        </div>
        <div class="button-row">
          ${isDraft ? '<span class="badge soft">Demo Draft</span>' : ""}
          <button class="secondary-button small" data-action="export-record">JSON 내보내기</button>
        </div>
      </div>
      <div class="summary-grid three">
        ${summaryItem("제출 시각", formatDateTime(record.patientSummary.submittedAt))}
        ${summaryItem("환자 이름", demographics.fullName || "미입력")}
        ${summaryItem("휴대폰 번호", formatPhoneNumber(demographics.phoneNumber))}
        ${summaryItem("이메일", demographics.emailAddress || "미입력")}
        ${summaryItem("환자 요약", `${record.patientSummary.sex} · ${record.patientSummary.age}세`)}
        ${summaryItem("문진 Risk", `App Risk ${record.patientSummary.appRiskClass}`)}
        ${summaryItem("활동성 우려 증상", record.patientSummary.activeConcern ? "있음" : "없음")}
        ${summaryItem("History Score", String(staticFeatures.history_score))}
        ${summaryItem("Neuropathy Score", String(staticFeatures.neuropathy_score))}
      </div>
    </section>

    <section class="question-card">
      <div class="question-head">
        <h3>임상 측정값 입력</h3>
        <span class="required-pill required">의사 기록</span>
      </div>
      <div class="clinician-grid">
        ${clinicianBooleanField("10 g monofilament 이상", "monofilament_abnormal", state.form.monofilament_abnormal)}
        ${clinicianNumberField("Pulse absent count", "pulse_absent_count", state.form.pulse_absent_count, "0~4", "1")}
        ${clinicianNumberField("TBI", "tbi_value", state.form.tbi_value, "예: 0.62", "0.01")}
        ${clinicianNumberField("Toe pressure", "toe_pressure_value", state.form.toe_pressure_value, "mmHg", "0.1")}
        ${clinicianNumberField("TcPO2", "tcpo2_value", state.form.tcpo2_value, "mmHg", "0.1")}
        ${clinicianBooleanField("Deformity present", "deformity_present", state.form.deformity_present)}
        ${clinicianBooleanField("Active wound present", "active_wound_present", state.form.active_wound_present)}
        ${clinicianBooleanField("Clinician redness", "clinician_redness", state.form.clinician_redness)}
        ${clinicianBooleanField("Clinician callus", "clinician_callus", state.form.clinician_callus)}
        ${clinicianBooleanField("Clinician edema", "clinician_edema", state.form.clinician_edema)}
        ${clinicianBooleanField("Clinician infection suspect", "clinician_infection_suspect", state.form.clinician_infection_suspect)}
        ${clinicianRiskField(state.form.iwgdf_confirmed_risk_class)}
      </div>
      <div class="button-row top-gap">
        <button class="primary-button dark" data-action="save-clinical">${isDraft ? "데모 레코드 저장" : "측정값 저장"}</button>
        <a class="secondary-button link-button" href="./admin.html">관리자 페이지로 이동</a>
        <a class="secondary-button link-button" href="./sensor.html">센서 결과 입력으로 이동</a>
      </div>
    </section>

    <section class="summary-card">
      <div class="summary-head">
        <div>
          <p class="step-caption">AI 입력 그룹</p>
          <h3>현재 결합 구조</h3>
        </div>
      </div>
      <div class="summary-grid three">
        ${summaryItem("Static feature", `${Object.keys(record.aiFeatureGroups.static).length}개`)}
        ${summaryItem("Clinical feature", `${Object.keys(record.aiFeatureGroups.clinical).length}개`)}
        ${summaryItem("Time-series feature", `${Object.keys(record.aiFeatureGroups.timeSeries).length}개`)}
        ${summaryItem("Sensor groups", `${Object.keys(record.aiFeatureGroups.sensor).length}개 묶음`)}
        ${summaryItem("Confirmed Risk", state.form.iwgdf_confirmed_risk_class === null ? "미정" : `Risk ${state.form.iwgdf_confirmed_risk_class}`)}
        ${summaryItem("Export", "JSON 내보내기 가능")}
      </div>
    </section>
  `;
}

function clinicianBooleanField(title, field, currentValue) {
  return `
    <article class="field-card">
      <strong>${escapeHtml(title)}</strong>
      <div class="choice-grid cols-3 top-gap">
        ${BOOLEAN_OPTIONS.map(
          (option) => `
            <button class="choice-button ${isBooleanOptionSelected(currentValue, option.value) ? "selected" : ""}" data-action="set-boolean" data-field="${field}" data-value="${option.value}">
              <strong>${escapeHtml(option.label)}</strong>
            </button>
          `,
        ).join("")}
      </div>
    </article>
  `;
}

function clinicianNumberField(title, field, currentValue, placeholder, step) {
  return `
    <article class="field-card">
      <strong>${escapeHtml(title)}</strong>
      <label class="number-field top-gap">
        <input type="number" inputmode="decimal" step="${step}" data-field="${field}" value="${escapeAttribute(currentValue ?? "")}" placeholder="${escapeAttribute(placeholder)}" />
        <span>입력</span>
      </label>
    </article>
  `;
}

function clinicianRiskField(currentValue) {
  return `
    <article class="field-card">
      <strong>IWGDF confirmed risk class</strong>
      <div class="choice-grid cols-3 top-gap">
        ${RISK_OPTIONS.map(
          (option) => `
            <button class="choice-button ${isRiskSelected(currentValue, option.value) ? "selected" : ""}" data-action="set-risk" data-value="${option.value}">
              <strong>${escapeHtml(option.label)}</strong>
            </button>
          `,
        ).join("")}
      </div>
    </article>
  `;
}

function summaryItem(label, value) {
  return `
    <article class="summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function isBooleanOptionSelected(currentValue, optionValue) {
  if (optionValue === "NULL") {
    return currentValue === null;
  }
  if (optionValue === "TRUE") {
    return currentValue === true;
  }
  return currentValue === false;
}

function isRiskSelected(currentValue, optionValue) {
  return optionValue === "NULL" ? currentValue === null : currentValue === Number(optionValue);
}

function parseBooleanValue(value) {
  if (value === "TRUE") {
    return true;
  }
  if (value === "FALSE") {
    return false;
  }
  return null;
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function formatPhoneNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    return "미입력";
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value ?? "");
}
