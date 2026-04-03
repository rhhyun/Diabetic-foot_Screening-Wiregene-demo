import {
  buildCombinedResearchRecord,
  createInitialQuestionnaireAnswers,
} from "./models.mjs";
import {
  deleteSavedResearchRecord,
  exportResearchRecord,
  listSavedResearchRecords,
  saveNewResearchRecord,
  updateSavedResearchRecord,
} from "./storage.mjs";

const root = document.querySelector("#app");

const OPTIONS = {
  gender: [
    { value: "MALE", label: "남성" },
    { value: "FEMALE", label: "여성" },
  ],
  diagnosisDuration: [
    { value: "UNDER_1_YEAR", label: "1년 미만" },
    { value: "YEAR_1_TO_5", label: "1~5년" },
    { value: "YEAR_5_TO_10", label: "5~10년" },
    { value: "OVER_10_YEARS", label: "10년 이상" },
    { value: "UNKNOWN", label: "모름" },
  ],
  treatmentType: [
    { value: "NONE", label: "아니오" },
    { value: "ORAL_MEDICATION", label: "먹는 약" },
    { value: "INSULIN", label: "인슐린" },
    { value: "ORAL_AND_INSULIN", label: "먹는 약과 인슐린 모두" },
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
    { value: "PAD", label: "말초혈관질환" },
    { value: "NONE", label: "없음" },
    { value: "UNKNOWN", label: "모름" },
  ],
  frequency4: [
    { value: "NONE", label: "전혀 없음" },
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
    { value: "WEEKLY_2_3", label: "주 2~3회" },
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
    { value: "MIN_30_TO_60", label: "30분~1시간" },
    { value: "HOUR_1_TO_2", label: "1~2시간" },
    { value: "OVER_2_HOURS", label: "2시간 이상" },
  ],
  smoking: [
    { value: "NO", label: "아니오" },
    { value: "PAST", label: "과거 흡연" },
    { value: "CURRENT", label: "현재 흡연" },
  ],
  sensorStudy: [
    { value: "YES", label: "예" },
    { value: "NO", label: "아니오" },
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
};

render();
initialize();

root.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const { action } = target.dataset;

  if (action === "refresh-records") {
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
  }

  render();
});

root.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  const { section, field } = target.dataset;
  if (!section || !field) return;
  state.form[section][field] = target.value || null;
  state.saveMessage = "";
  render();
});

root.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const { section, field } = target.dataset;
  if (!section || !field) return;
  state.form[section][field] = target.value;
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
    ? structuredClone(selected.questionnairePayload.questionnaireData)
    : createInitialQuestionnaireAnswers();
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
    questionnaireAnswers: structuredClone(state.form),
  });
  const now = combined.questionnairePayload.submittedAt;
  return {
    ...combined,
    recordId: "DEMO-QUESTIONNAIRE-DRAFT",
    createdAt: now,
    updatedAt: now,
    patientSummary: {
      submittedAt: now,
      sex: labelFor(OPTIONS.gender, state.form.demographics.gender),
      age: state.form.demographics.age || "미입력",
      appRiskClass: combined.questionnairePayload.internalScores.app_risk_class,
      activeConcern: combined.questionnairePayload.internalFlags.active_concerning_foot_symptom,
    },
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
  if (!selected) {
    const saved = await saveNewResearchRecord(
      buildCombinedResearchRecord({
        questionnaireAnswers: structuredClone(state.form),
      }),
    );
    state.selectedRecordId = saved.recordId;
    await refreshRecords();
    state.saveMessage = "데모 관리자 레코드가 저장되었습니다.";
    return;
  }

  const updated = buildCombinedResearchRecord({
    questionnaireAnswers: structuredClone(state.form),
    clinicianMeasurements: structuredClone(selected.clinicianMeasurements),
    longitudinalFeatures: structuredClone(selected.aiFeatureGroups.timeSeries),
    sensorFeatureBundle: structuredClone(selected.aiFeatureGroups.sensor),
    ruleFusionSignals: structuredClone(selected.ruleFusionSignals),
  });

  const saved = await updateSavedResearchRecord(selected.recordId, updated);
  if (saved) {
    await refreshRecords();
    state.saveMessage = "관리자 수정 내용이 저장되었습니다.";
  }
}

async function deleteSelectedRecord() {
  const selected = getSelectedRecord();
  if (!selected) return;
  const confirmed = window.confirm(`레코드 ${selected.recordId} 를 삭제하시겠습니까?`);
  if (!confirmed) return;
  await deleteSavedResearchRecord(selected.recordId);
  await refreshRecords();
  state.saveMessage = "레코드가 삭제되었습니다.";
}

function render() {
  const selected = getSelectedRecord();
  const working = getWorkingRecord();
  const isDraft = !selected;
  const payload = working.questionnairePayload;
  const scores = payload.internalScores;

  root.innerHTML = `
    <main class="app-shell admin-shell">
      <aside class="side-panel">
        <section class="hero-card">
          <p class="eyebrow">Admin Demo</p>
          <h1><span>환자 데이터 관리</span><span>관리자 페이지</span></h1>
          <p>저장된 환자 문진이 없어도 데모 초안을 바로 편집할 수 있습니다.</p>
        </section>
        <section class="progress-card">
          <p class="eyebrow tint">저장된 레코드</p>
          <p class="metric-value">${state.records.length}</p>
          <div class="button-row top-gap">
            <button class="secondary-button small" data-action="refresh-records">목록 새로고침</button>
            <a class="secondary-button small link-button" href="./clinician.html">의사용 측정</a>
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
              <span class="badge">Admin Edit</span>
              <span class="badge soft">${isDraft ? "Demo Draft" : "Saved Record"}</span>
            </div>
            <div class="top-copyright">Copyright 2026 Wiregene Co., Ltd.</div>
          </div>
          <div class="panel-heading">
            <div>
              <p class="step-caption">관리자 편집 화면</p>
              <h2>${isDraft ? "데모 문진 초안 입력" : "선택한 환자 문진 수정"}</h2>
              <p class="step-description">
                ${isDraft ? "현재 브라우저 안에서 데모 문진을 바로 만들 수 있습니다." : "선택한 환자 문진을 수정하면 내부 위험 요약도 함께 다시 계산됩니다."}
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
                ${isDraft ? '<span class="badge soft">Demo Draft</span>' : '<button class="secondary-button small danger-button" data-action="delete-record">Delete</button>'}
                <button class="secondary-button small" data-action="export-record">JSON 내보내기</button>
              </div>
            </div>
            <div class="summary-grid three">
              ${summaryItem("제출 시각", formatDateTime(payload.submittedAt))}
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
            <p>${isDraft ? "저장하면 이 브라우저에 데모 레코드가 생성됩니다." : "변경한 내용은 현재 레코드에 반영됩니다."}</p>
            <div class="button-row">
              <button class="secondary-button" data-action="reset-form">변경 취소</button>
              <button class="primary-button dark" data-action="save-questionnaire">${isDraft ? "데모 레코드 저장" : "변경 저장"}</button>
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
      <span>${escapeHtml(record.patientSummary.sex)} · ${escapeHtml(String(record.patientSummary.age))}세 · App Risk ${escapeHtml(String(record.patientSummary.appRiskClass))}</span>
      <span>${formatDateTime(record.updatedAt)}</span>
    </button>
  `;
}

function renderEmptyRecordList() {
  return `
    <div class="empty-card">
      <strong>저장된 환자 문진이 없습니다.</strong>
      <p>오른쪽에서 데모 초안을 바로 입력한 뒤 저장할 수 있습니다.</p>
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
    ${fieldCard("발 저림/감각 둔화", selectField("neuropathy", "numbness", n.numbness, OPTIONS.frequency4))}
    ${fieldCard("발바닥 감각 둔화", selectField("neuropathy", "reducedSoleSensation", n.reducedSoleSensation, OPTIONS.frequency4))}
    ${fieldCard("화끈거림", selectField("neuropathy", "burning", n.burning, OPTIONS.frequency4))}
    ${fieldCard("야간 통증", selectField("neuropathy", "nightPain", n.nightPain, OPTIONS.nightPain))}
    ${fieldCard("온도 감각 저하", selectField("neuropathy", "temperatureLoss", n.temperatureLoss, OPTIONS.yesNoUnknown))}
  `);
}

function renderIschemiaSection() {
  const i = state.form.ischemia;
  return renderSectionCard("혈액순환 증상", `
    ${fieldCard("걷다가 아프고 쉬면 호전", selectField("ischemia", "walkingPainRelievedByRest", i.walkingPainRelievedByRest, OPTIONS.yesNoUnknown))}
    ${fieldCard("휴식 시 통증", selectField("ischemia", "restPain", i.restPain, OPTIONS.threeLevel))}
    ${fieldCard("발 냉감", selectField("ischemia", "coldFeet", i.coldFeet, OPTIONS.threeLevel))}
    ${fieldCard("상처 치유 지연", selectField("ischemia", "slowHealing", i.slowHealing, OPTIONS.yesNoUnknown))}
    ${fieldCard("혈액순환 진단 이력", selectField("ischemia", "circulationDiagnosis", i.circulationDiagnosis, OPTIONS.yesNoUnknown))}
  `);
}

function renderCurrentFootSection() {
  const c = state.form.currentFoot;
  return renderSectionCard("현재 발 상태", `
    ${fieldCard("상처", selectField("currentFoot", "wound", c.wound, OPTIONS.presentAbsentUnknown))}
    ${fieldCard("발적", selectField("currentFoot", "redness", c.redness, OPTIONS.presentAbsentUnknown))}
    ${fieldCard("붓기/열감", selectField("currentFoot", "swellingOrHeat", c.swellingOrHeat, OPTIONS.presentAbsentUnknown))}
    ${fieldCard("굳은살/갈라짐/물집", selectField("currentFoot", "callusCrackBlister", c.callusCrackBlister, OPTIONS.presentAbsentUnknown))}
    ${fieldCard("발톱/발모양 변형", selectField("currentFoot", "nailOrShapeDeformity", c.nailOrShapeDeformity, OPTIONS.presentAbsentUnknown))}
  `);
}

function renderSelfCareSection() {
  const s = state.form.selfCare;
  return renderSectionCard("발 관리 습관", `
    ${fieldCard("매일 발 확인", selectField("selfCare", "dailyCheck", s.dailyCheck, OPTIONS.footCheck))}
    ${fieldCard("발가락 사이 건조", selectField("selfCare", "dryBetweenToes", s.dryBetweenToes, OPTIONS.care))}
    ${fieldCard("상처 시 빠른 대처", selectField("selfCare", "earlyActionForWounds", s.earlyActionForWounds, OPTIONS.care))}
    ${fieldCard("맨발 보행", selectField("selfCare", "walksBarefoot", s.walksBarefoot, OPTIONS.barefoot))}
  `);
}

function renderFootwearSection() {
  const f = state.form.footwear;
  return renderSectionCard("신발·보행 습관", `
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
    ${fieldCard("혼자 발 관리 어려움", selectField("comorbidity", "selfCareDifficulty", c.selfCareDifficulty, OPTIONS.yesNo))}
  `);
}

function renderResearchSection() {
  const r = state.form.research;
  return renderSectionCard("추가 연구 참여", `
    ${fieldCard("발 사진 동의", selectField("research", "photoConsent", r.photoConsent, OPTIONS.yesNo))}
    ${fieldCard("센서 연구 참여", selectField("research", "sensorStudyInterest", r.sensorStudyInterest, OPTIONS.sensorStudy))}
    ${fieldCard("추적 문진 알림", selectField("research", "followUpConsent", r.followUpConsent, OPTIONS.yesNo))}
  `);
}

function renderSectionCard(title, content) {
  return `
    <section class="question-card">
      <div class="question-head">
        <h3>${escapeHtml(title)}</h3>
        <span class="required-pill optional">수정 가능</span>
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

function selectField(section, field, value, options) {
  return `
    <label class="select-field">
      <select data-section="${section}" data-field="${field}">
        <option value="">선택해 주세요</option>
        ${options
          .map(
            (option) => `<option value="${escapeAttribute(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
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

function summaryItem(label, value) {
  return `
    <article class="summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
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
