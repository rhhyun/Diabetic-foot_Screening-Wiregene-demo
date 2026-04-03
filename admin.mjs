import {
  buildCombinedResearchRecord,
  buildQuestionnairePayload,
  buildQuestionnaireStaticFeatures,
  buildRuleBasedFusionFlags,
  createInitialClinicianMeasurements,
  createInitialLongitudinalFeatures,
  createInitialQuestionnaireAnswers,
  createInitialRuleFusionSignals,
  createInitialSensorFeatureBundle,
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
    { value: "UNKNOWN", label: "잘 모르겠음" },
  ],
  treatmentType: [
    { value: "NONE", label: "아니오" },
    { value: "ORAL_MEDICATION", label: "먹는 약" },
    { value: "INSULIN", label: "인슐린" },
    { value: "ORAL_AND_INSULIN", label: "먹는 약과 인슐린 모두" },
    { value: "UNKNOWN", label: "잘 모르겠음" },
  ],
  yesNo: [
    { value: "YES", label: "예" },
    { value: "NO", label: "아니오" },
  ],
  yesNoUnknown: [
    { value: "YES", label: "예" },
    { value: "NO", label: "아니오" },
    { value: "UNKNOWN", label: "모르겠음" },
  ],
  hbA1cMode: [
    { value: "ENTER_VALUE", label: "수치를 입력함" },
    { value: "UNKNOWN", label: "모름" },
  ],
  diagnosedConditions: [
    { value: "DIABETIC_FOOT", label: "당뇨발" },
    { value: "NEUROPATHY", label: "말초신경병증" },
    { value: "PAD", label: "말초혈관질환" },
    { value: "NONE", label: "없음" },
    { value: "UNKNOWN", label: "모르겠음" },
  ],
  frequency4: [
    { value: "NONE", label: "전혀 없음" },
    { value: "SOMETIMES", label: "가끔 있음" },
    { value: "OFTEN", label: "자주 있음" },
    { value: "ALMOST_ALWAYS", label: "거의 항상 있음" },
  ],
  nightPain: [
    { value: "NONE", label: "아니오" },
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
    { value: "UNKNOWN", label: "모르겠음" },
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
  if (!target) {
    return;
  }

  const { action } = target.dataset;

  if (action === "refresh-records") {
    await refreshRecords();
  } else if (action === "select-record") {
    state.selectedRecordId = target.dataset.recordId;
    syncFormWithSelection();
  } else if (action === "toggle-condition") {
    toggleCondition(target.dataset.value);
  } else if (action === "save-questionnaire") {
    await saveQuestionnaireEdits();
  } else if (action === "delete-record") {
    await deleteSelectedRecord();
  } else if (action === "reset-form") {
    syncFormWithSelection();
  } else if (action === "export-record") {
    const record = getDisplayRecord();
    if (record) {
      exportResearchRecord(record);
    }
  }

  render();
});

root.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  const { section, field } = target.dataset;
  if (!section || !field) {
    return;
  }

  updateQuestionnaireField(section, field, target.value || null);
  render();
});

root.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
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
    ? structuredClone(selected.questionnairePayload?.questionnaireData ?? createInitialQuestionnaireAnswers())
    : createInitialQuestionnaireAnswers();
  state.saveMessage = "";
}

function getSelectedRecord() {
  if (!state.selectedRecordId) {
    return null;
  }

  return state.records.find((record) => record.recordId === state.selectedRecordId) ?? null;
}

function getDisplayRecord() {
  return getSelectedRecord() ?? createDraftAdminRecord();
}

function createDraftAdminRecord() {
  const questionnairePayload = buildQuestionnairePayload(state.form);
  const staticFeatures = buildQuestionnaireStaticFeatures(questionnairePayload);
  const now = questionnairePayload.submittedAt ?? new Date().toISOString();
  const ruleFusionSignals = createInitialRuleFusionSignals();

  return {
    recordId: "DEMO-QUESTIONNAIRE-DRAFT",
    createdAt: now,
    updatedAt: now,
    questionnairePayload,
    clinicianMeasurements: createInitialClinicianMeasurements(),
    aiFeatureGroups: {
      static: staticFeatures,
      clinical: createInitialClinicianMeasurements(),
      timeSeries: createInitialLongitudinalFeatures(),
      sensor: createInitialSensorFeatureBundle(),
    },
    ruleFusionSignals,
    ruleFusionFlags: buildRuleBasedFusionFlags(staticFeatures, ruleFusionSignals),
    patientSummary: {
      submittedAt: now,
      sex: labelFor(OPTIONS.gender, state.form.demographics.gender),
      age: state.form.demographics.age || "미입력",
      appRiskClass: staticFeatures.app_risk_class,
      activeConcern: questionnairePayload.internalFlags.active_concerning_foot_symptom,
    },
  };
}

function updateQuestionnaireField(section, field, value) {
  state.form[section][field] = value;

  if (section === "diabetes" && field === "knowsRecentGlucoseOrHbA1c" && value !== "YES") {
    state.form.diabetes.hbA1cMode = null;
    state.form.diabetes.hbA1c = "";
  }

  if (section === "diabetes" && field === "hbA1cMode" && value !== "ENTER_VALUE") {
    state.form.diabetes.hbA1c = "";
  }

  state.saveMessage = "";
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

async function saveQuestionnaireEdits() {
  const selected = getSelectedRecord();
  if (!selected) {
    const saved = await saveNewResearchRecord(
      buildCombinedResearchRecord({
        questionnaireAnswers: structuredClone(state.form),
      }),
    );
    state.selectedRecordId = saved.recordId;
    await refreshRecords();
    state.saveMessage = "데모 문진 레코드가 새로 저장되었습니다.";
    return;
  }

  const updated = structuredClone(selected);
  const questionnairePayload = buildQuestionnairePayload(state.form);
  questionnairePayload.submittedAt =
    selected.questionnairePayload?.submittedAt ?? questionnairePayload.submittedAt;

  updated.questionnairePayload = questionnairePayload;
  updated.aiFeatureGroups = {
    static: buildQuestionnaireStaticFeatures(questionnairePayload),
    clinical: structuredClone(
      updated.aiFeatureGroups?.clinical ??
        updated.clinicianMeasurements ??
        createInitialClinicianMeasurements(),
    ),
    timeSeries: structuredClone(
      updated.aiFeatureGroups?.timeSeries ?? createInitialLongitudinalFeatures(),
    ),
    sensor: structuredClone(
      updated.aiFeatureGroups?.sensor ?? createInitialSensorFeatureBundle(),
    ),
  };
  updated.ruleFusionSignals = structuredClone(
    updated.ruleFusionSignals ?? createInitialRuleFusionSignals(),
  );
  updated.ruleFusionFlags = buildRuleBasedFusionFlags(
    updated.aiFeatureGroups.static,
    updated.ruleFusionSignals,
  );

  const saved = await updateSavedResearchRecord(selected.recordId, updated);
  if (saved) {
    state.saveMessage = "환자 문진 데이터가 수정되었습니다.";
    await refreshRecords();
  }
}

async function deleteSelectedRecord() {
  const selected = getSelectedRecord();
  if (!selected) {
    return;
  }

  const confirmed = window.confirm(
    `선택한 환자 레코드 ${selected.recordId} 를 삭제하시겠습니까?\n삭제 후에는 관리자, 의사용 측정, 센서 입력 화면에서 더 이상 볼 수 없습니다.`,
  );
  if (!confirmed) {
    return;
  }

  const deleted = await deleteSavedResearchRecord(selected.recordId);
  if (!deleted) {
    state.saveMessage = "환자 레코드를 삭제하지 못했습니다.";
    return;
  }

  state.saveMessage = `환자 레코드 ${selected.recordId} 가 삭제되었습니다.`;
  await refreshRecords();
  state.saveMessage = `환자 레코드 ${selected.recordId} 가 삭제되었습니다.`;
}

function render() {
  const selected = getSelectedRecord();
  const displayRecord = getDisplayRecord();
  const isDraft = !selected;
  root.innerHTML = `
    <main class="app-shell admin-shell">
      <aside class="side-panel">
        <section class="hero-card">
          <p class="eyebrow">Admin Console</p>
          <h1><span>환자 데이터 관리</span><span>관리자 페이지</span></h1>
          <p>완료된 환자 문진 목록을 확인하고, 필요한 항목을 수정한 뒤 다시 저장할 수 있습니다.</p>
        </section>
        <section class="progress-card">
          <p class="eyebrow tint">저장된 환자 문진</p>
          <p class="metric-value">${state.records.length}</p>
          <div class="button-row top-gap">
            <button class="secondary-button small" data-action="refresh-records">목록 새로고침</button>
            <a class="secondary-button small link-button" href="./clinician.html">의사용 측정</a>
            <a class="secondary-button small link-button" href="./sensor.html">센서 입력</a>
            <a class="secondary-button small link-button" href="./index.html">환자 문진</a>
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
              <span class="badge">Admin Edit</span>
              <span class="badge soft">Patient Questionnaire</span>
            </div>
            <div class="top-copyright">Copyright 2026 Wiregene Co., Ltd.</div>
          </div>
          <div class="panel-heading">
            <div>
              <p class="step-caption">관리자 편집 화면</p>
              <h2>${selected ? "선택한 환자 문진 수정" : "데모 문진 초안 입력"}</h2>
              <p class="step-description">
                ${
                  selected
                    ? "문진 답변을 수정하면 앱 위험분류와 내부 점수가 함께 다시 계산됩니다. 의사 측정값과 센서 결과는 그대로 유지됩니다."
                    : "저장된 환자 문진이 없어도 데모 초안을 바로 입력할 수 있습니다. 저장하면 이 브라우저에 데모 레코드가 생성됩니다."
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
      <span>${escapeHtml(record.patientSummary.sex)} · ${escapeHtml(String(record.patientSummary.age))}세 · App Risk ${escapeHtml(String(record.patientSummary.appRiskClass))}</span>
      <span>${formatDateTime(record.updatedAt)}</span>
    </button>
  `;
}

function renderEmptyRecordList() {
  return `
    <div class="empty-card">
      <strong>저장된 환자 문진이 없습니다.</strong>
      <p>오른쪽에서 데모 초안을 바로 입력할 수 있습니다. 저장하면 이 브라우저에 데모 레코드가 생성됩니다.</p>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <section class="empty-card large">
      <strong>선택된 레코드가 없습니다.</strong>
      <p>좌측 목록에서 환자 문진을 선택하면 상세 내용과 수정 폼이 열립니다.</p>
    </section>
  `;
}

function renderSelectedRecord(record, isDraft = false) {
  const previewPayload = buildQuestionnairePayload(state.form);
  previewPayload.submittedAt = record.questionnairePayload?.submittedAt ?? previewPayload.submittedAt;
  const previewStatic = buildQuestionnaireStaticFeatures(previewPayload);

  return `
    <section class="summary-card">
      <div class="summary-head">
        <div>
          <p class="step-caption">연구 레코드</p>
          <h3>${escapeHtml(record.recordId)}</h3>
        </div>
        <div class="button-row">
          ${isDraft ? '<span class="badge soft">Demo Draft</span>' : '<button class="secondary-button small danger-button" data-action="delete-record">Delete</button>'}
          <button class="secondary-button small" data-action="export-record">JSON 내보내기</button>
          <a class="secondary-button small link-button" href="./clinician.html">의사 측정</a>
          <a class="secondary-button small link-button" href="./sensor.html">센서 입력</a>
        </div>
      </div>
      <div class="summary-grid three">
        ${summaryItem("제출 시각", formatDateTime(record.patientSummary.submittedAt))}
        ${summaryItem("마지막 수정", formatDateTime(record.updatedAt))}
        ${summaryItem("환자 이름", state.form.demographics.fullName || "미입력")}
        ${summaryItem("휴대폰 번호", formatPhoneNumber(state.form.demographics.phoneNumber))}
        ${summaryItem("이메일", state.form.demographics.emailAddress || "미입력")}
        ${summaryItem("성별/연령", `${labelFor(OPTIONS.gender, state.form.demographics.gender)} · ${numericText(state.form.demographics.age, "세")}`)}
        ${summaryItem("현재 App Risk", `Risk ${previewStatic.app_risk_class}`)}
        ${summaryItem("주의 신호", previewPayload.internalFlags.active_concerning_foot_symptom ? "있음" : "없음")}
        ${summaryItem("당화혈색소", previewStatic.hba1c_value ?? "미입력")}
        ${summaryItem("History Score", String(previewStatic.history_score))}
        ${summaryItem("Neuropathy Score", String(previewStatic.neuropathy_score))}
        ${summaryItem("Ischemia Score", String(previewStatic.ischemia_score))}
      </div>
    </section>

    ${renderBasicInfoSection()}
    ${renderDiabetesSection()}
    ${renderHistorySection()}
    ${renderNeuropathySection()}
    ${renderIschemiaSection()}
    ${renderCurrentFootSection()}
    ${renderSelfCareSection()}
    ${renderFootwearSection()}
    ${renderComorbiditySection()}

    <section class="sticky-footer">
      <p>${isDraft ? "저장하면 현재 문진 내용을 기준으로 데모 레코드가 새로 생성됩니다." : "수정한 내용은 저장 즉시 같은 환자 레코드에 반영되고, 내부 위험요약도 함께 갱신됩니다."}</p>
      <div class="button-row">
        <button class="secondary-button" data-action="reset-form">변경 취소</button>
        <button class="primary-button dark" data-action="save-questionnaire">${isDraft ? "데모 레코드 저장" : "변경 저장"}</button>
      </div>
    </section>
  `;
}

function renderBasicInfoSection() {
  return renderSectionCard(
    "기본정보",
    "인구학 정보",
    `
      ${fieldCard("환자 이름", textField("demographics", "fullName", state.form.demographics.fullName, "text", "예: 홍길동"))}
      ${fieldCard("휴대폰 번호", textField("demographics", "phoneNumber", state.form.demographics.phoneNumber, "tel", "예: 01012345678"))}
      ${fieldCard("이메일", textField("demographics", "emailAddress", state.form.demographics.emailAddress, "email", "예: wiregene@example.com"))}
      ${fieldCard("성별", choiceGrid("demographics", "gender", state.form.demographics.gender, OPTIONS.gender))}
      ${fieldCard("연령", numberField("demographics", "age", state.form.demographics.age, "세", "예: 68"))}
      ${fieldCard("키", numberField("demographics", "heightCm", state.form.demographics.heightCm, "cm", "예: 163"))}
      ${fieldCard("몸무게", numberField("demographics", "weightKg", state.form.demographics.weightKg, "kg", "예: 61"))}
    `,
  );
}

function renderDiabetesSection() {
  const diabetes = state.form.diabetes;

  return renderSectionCard(
    "당뇨 정보",
    "진단 기간과 치료 정보",
    `
      ${fieldCard("당뇨병 진단 기간", choiceGrid("diabetes", "diagnosisDuration", diabetes.diagnosisDuration, OPTIONS.diagnosisDuration, 3))}
      ${fieldCard("현재 치료", choiceGrid("diabetes", "treatmentType", diabetes.treatmentType, OPTIONS.treatmentType, 3))}
      ${fieldCard("최근 혈당 또는 당화혈색소 수치 인지 여부", choiceGrid("diabetes", "knowsRecentGlucoseOrHbA1c", diabetes.knowsRecentGlucoseOrHbA1c, OPTIONS.yesNo))}
      ${
        diabetes.knowsRecentGlucoseOrHbA1c === "YES"
          ? fieldCard(
              "최근 당화혈색소",
              `
                ${choiceGrid("diabetes", "hbA1cMode", diabetes.hbA1cMode, OPTIONS.hbA1cMode)}
                ${diabetes.hbA1cMode === "ENTER_VALUE" ? `<div class="top-gap">${numberField("diabetes", "hbA1c", diabetes.hbA1c, "%", "예: 7.2", "0.1")}</div>` : ""}
              `,
            )
          : ""
      }
    `,
  );
}

function renderHistorySection() {
  const history = state.form.history;

  return renderSectionCard(
    "과거 발 병력",
    "기존 당뇨발 관련 이력",
    `
      ${fieldCard("이전 발 상처 또는 궤양", choiceGrid("history", "ulcerHistory", history.ulcerHistory, OPTIONS.yesNoUnknown))}
      ${fieldCard("절단 이력", choiceGrid("history", "amputationHistory", history.amputationHistory, OPTIONS.yesNo))}
      ${fieldCard("입원/시술/수술 이력", choiceGrid("history", "admissionOrProcedureHistory", history.admissionOrProcedureHistory, OPTIONS.yesNoUnknown))}
      ${fieldCard("의사 진단 이력", multiSelectGrid(history.diagnosedConditions), "여러 항목을 동시에 선택할 수 있습니다.", "full-span")}
    `,
  );
}

function renderNeuropathySection() {
  const neuropathy = state.form.neuropathy;

  return renderSectionCard(
    "발 저림·통증",
    "신경병증 관련 증상",
    `
      ${fieldCard("발 저림 또는 감각 둔화", choiceGrid("neuropathy", "numbness", neuropathy.numbness, OPTIONS.frequency4, 2))}
      ${fieldCard("발바닥 감각 둔화", choiceGrid("neuropathy", "reducedSoleSensation", neuropathy.reducedSoleSensation, OPTIONS.frequency4, 2))}
      ${fieldCard("화끈거리거나 타는 느낌", choiceGrid("neuropathy", "burning", neuropathy.burning, OPTIONS.frequency4, 2))}
      ${fieldCard("야간 통증 또는 불편감", choiceGrid("neuropathy", "nightPain", neuropathy.nightPain, OPTIONS.nightPain, 2))}
      ${fieldCard("온도 감각 저하", choiceGrid("neuropathy", "temperatureLoss", neuropathy.temperatureLoss, OPTIONS.yesNoUnknown), "", "full-span")}
    `,
  );
}

function renderIschemiaSection() {
  const ischemia = state.form.ischemia;

  return renderSectionCard(
    "혈액순환 증상",
    "허혈 및 PAD 관련 증상",
    `
      ${fieldCard("걸을 때 통증 후 쉬면 호전", choiceGrid("ischemia", "walkingPainRelievedByRest", ischemia.walkingPainRelievedByRest, OPTIONS.yesNoUnknown))}
      ${fieldCard("쉬고 있을 때 발 통증", choiceGrid("ischemia", "restPain", ischemia.restPain, OPTIONS.threeLevel))}
      ${fieldCard("발 냉감", choiceGrid("ischemia", "coldFeet", ischemia.coldFeet, OPTIONS.threeLevel))}
      ${fieldCard("상처 치유 지연", choiceGrid("ischemia", "slowHealing", ischemia.slowHealing, OPTIONS.yesNoUnknown))}
      ${fieldCard("혈액순환 문제 진단 이력", choiceGrid("ischemia", "circulationDiagnosis", ischemia.circulationDiagnosis, OPTIONS.yesNoUnknown), "", "full-span")}
    `,
  );
}

function renderCurrentFootSection() {
  const currentFoot = state.form.currentFoot;

  return renderSectionCard(
    "현재 발 상태",
    "현재 관찰된 발 상태",
    `
      ${fieldCard("현재 상처", choiceGrid("currentFoot", "wound", currentFoot.wound, OPTIONS.presentAbsentUnknown))}
      ${fieldCard("붉은 부위", choiceGrid("currentFoot", "redness", currentFoot.redness, OPTIONS.presentAbsentUnknown))}
      ${fieldCard("붓기 또는 열감", choiceGrid("currentFoot", "swellingOrHeat", currentFoot.swellingOrHeat, OPTIONS.presentAbsentUnknown))}
      ${fieldCard("굳은살/갈라짐/물집", choiceGrid("currentFoot", "callusCrackBlister", currentFoot.callusCrackBlister, OPTIONS.presentAbsentUnknown))}
      ${fieldCard("발톱 변형 또는 발 모양 변형", choiceGrid("currentFoot", "nailOrShapeDeformity", currentFoot.nailOrShapeDeformity, OPTIONS.presentAbsentUnknown), "", "full-span")}
    `,
  );
}

function renderSelfCareSection() {
  const selfCare = state.form.selfCare;

  return renderSectionCard(
    "발 관리 습관",
    "자가 관리 행동",
    `
      ${fieldCard("매일 발 상태 확인", choiceGrid("selfCare", "dailyCheck", selfCare.dailyCheck, OPTIONS.footCheck, 2))}
      ${fieldCard("발가락 사이까지 잘 말리기", choiceGrid("selfCare", "dryBetweenToes", selfCare.dryBetweenToes, OPTIONS.care))}
      ${fieldCard("상처 시 빠른 확인 또는 치료", choiceGrid("selfCare", "earlyActionForWounds", selfCare.earlyActionForWounds, OPTIONS.care))}
      ${fieldCard("맨발로 걷는 습관", choiceGrid("selfCare", "walksBarefoot", selfCare.walksBarefoot, OPTIONS.barefoot))}
    `,
  );
}

function renderFootwearSection() {
  const footwear = state.form.footwear;

  return renderSectionCard(
    "신발·보행 습관",
    "신발과 보행 관련 위험요인",
    `
      ${fieldCard("꽉 끼는 신발 착용", choiceGrid("footwear", "tightShoes", footwear.tightShoes, OPTIONS.tightShoes))}
      ${fieldCard("새 신발 뒤 통증 또는 상처", choiceGrid("footwear", "newShoeInjury", footwear.newShoeInjury, OPTIONS.yesNo))}
      ${fieldCard("하루 평균 걷는 시간", choiceGrid("footwear", "walkingTime", footwear.walkingTime, OPTIONS.walkingTime, 2))}
      ${fieldCard("보행 불균형", choiceGrid("footwear", "gaitImbalance", footwear.gaitImbalance, OPTIONS.yesNoUnknown))}
    `,
  );
}

function renderComorbiditySection() {
  const comorbidity = state.form.comorbidity;

  return renderSectionCard(
    "동반질환 및 위험요인",
    "생활 및 기저질환 정보",
    `
      ${fieldCard("흡연 상태", choiceGrid("comorbidity", "smokingStatus", comorbidity.smokingStatus, OPTIONS.smoking))}
      ${fieldCard("신장질환 또는 투석", choiceGrid("comorbidity", "kidneyDiseaseOrDialysis", comorbidity.kidneyDiseaseOrDialysis, OPTIONS.yesNoUnknown))}
      ${fieldCard("발 확인이 어려울 정도의 시야 문제", choiceGrid("comorbidity", "visionDifficulty", comorbidity.visionDifficulty, OPTIONS.yesNo))}
      ${fieldCard("혼자 발 관리가 어려움", choiceGrid("comorbidity", "selfCareDifficulty", comorbidity.selfCareDifficulty, OPTIONS.yesNo))}
    `,
  );
}

function renderSectionCard(caption, title, content) {
  return `
    <section class="question-card">
      <div class="question-head">
        <div>
          <p class="step-caption">${escapeHtml(caption)}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <span class="required-pill optional">수정 가능</span>
      </div>
      <div class="clinician-grid top-gap">
        ${content}
      </div>
    </section>
  `;
}

function fieldCard(title, body, hint = "", extraClass = "") {
  return `
    <article class="field-card ${extraClass}">
      <strong>${escapeHtml(title)}</strong>
      ${hint ? `<p class="helper-text">${escapeHtml(hint)}</p>` : ""}
      <div class="top-gap">${body}</div>
    </article>
  `;
}

function choiceGrid(section, field, currentValue, options) {
  return `
    <label class="select-field">
      <select data-section="${section}" data-field="${field}">
        <option value="">선택 안 함</option>
        ${options
          .map(
            (option) => `
              <option value="${escapeAttribute(option.value)}" ${option.value === currentValue ? "selected" : ""}>
                ${escapeHtml(option.label)}
              </option>
            `,
          )
          .join("")}
      </select>
    </label>
  `;
}

function multiSelectGrid(selectedValues) {
  return `
    <div class="choice-grid cols-3">
      ${OPTIONS.diagnosedConditions
        .map(
          (option) => `
            <button
              type="button"
              class="choice-button ${selectedValues.includes(option.value) ? "selected" : ""}"
              data-action="toggle-condition"
              data-value="${option.value}"
            >
              <strong>${escapeHtml(option.label)}</strong>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function numberField(section, field, value, unit, placeholder, step = "1") {
  return `
    <label class="number-field">
      <input
        type="number"
        inputmode="decimal"
        step="${step}"
        placeholder="${escapeHtml(placeholder)}"
        value="${escapeAttribute(value ?? "")}"
        data-section="${section}"
        data-field="${field}"
      />
      <span>${escapeHtml(unit)}</span>
    </label>
  `;
}

function textField(section, field, value, type, placeholder) {
  return `
    <label class="text-field">
      <input
        type="${type}"
        placeholder="${escapeHtml(placeholder)}"
        value="${escapeAttribute(value ?? "")}"
        data-section="${section}"
        data-field="${field}"
      />
    </label>
  `;
}

function summaryItem(label, value) {
  return `
    <div class="summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value ?? "미입력"))}</strong>
    </div>
  `;
}

function labelFor(options, value) {
  if (!value) {
    return "미입력";
  }

  const found = options.find((option) => option.value === value);
  return found ? found.label : "미입력";
}

function numericText(value, unit) {
  return value ? `${value}${unit}` : "미입력";
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

function formatDateTime(value) {
  if (!value) {
    return "미입력";
  }

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
