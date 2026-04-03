import {
  buildRuleBasedFusionFlags,
  createInitialLongitudinalFeatures,
  createInitialRuleFusionSignals,
  createInitialSensorFeatureBundle,
} from "./models.mjs";
import {
  exportResearchRecord,
  listSavedResearchRecords,
  updateSavedResearchRecord,
} from "./storage.mjs";

const root = document.querySelector("#app");

const TIME_SERIES_FIELDS = [
  { key: "day_index", label: "Day index", step: "1", placeholder: "예: 7" },
  {
    key: "symptom_change_from_baseline",
    label: "Symptom change from baseline",
    step: "0.1",
    placeholder: "예: 1.5",
  },
  {
    key: "temperature_change_from_baseline",
    label: "Temperature change from baseline",
    step: "0.1",
    placeholder: "예: 1.2",
  },
  {
    key: "pressure_change_from_baseline",
    label: "Pressure change from baseline",
    step: "0.1",
    placeholder: "예: 12.5",
  },
  {
    key: "perfusion_change_from_baseline",
    label: "Perfusion change from baseline",
    step: "0.1",
    placeholder: "예: -0.8",
  },
  {
    key: "activity_change_from_baseline",
    label: "Activity change from baseline",
    step: "0.1",
    placeholder: "예: 320",
  },
  { key: "adherence_rate", label: "Adherence rate", step: "0.01", placeholder: "예: 0.86" },
  { key: "image_change_score", label: "Image change score", step: "0.1", placeholder: "예: 2.4" },
];

const SENSOR_GROUPS = [
  {
    group: "optical",
    title: "광학/미세순환 feature",
    fields: [
      { key: "perfusion_index", label: "Perfusion index", step: "0.01" },
      { key: "pulsatile_amplitude", label: "Pulsatile amplitude", step: "0.01" },
      { key: "signal_quality_index", label: "Signal quality index", step: "0.01" },
      { key: "local_heating_response", label: "Local heating response", step: "0.01" },
      { key: "time_to_peak", label: "Time to peak", step: "0.01" },
      { key: "recovery_slope", label: "Recovery slope", step: "0.01" },
      { key: "spo2_reflectance_estimate", label: "SpO2 reflectance estimate", step: "0.01" },
    ],
  },
  {
    group: "thermal",
    title: "열영상 feature",
    fields: [
      { key: "bilateral_temp_diff_max", label: "Bilateral temp diff max", step: "0.01" },
      { key: "regional_temp_diff_mean", label: "Regional temp diff mean", step: "0.01" },
      { key: "hotspot_count", label: "Hotspot count", step: "1" },
      { key: "hotspot_persistence_days", label: "Hotspot persistence days", step: "1" },
      { key: "thermal_heterogeneity_index", label: "Thermal heterogeneity index", step: "0.01" },
    ],
  },
  {
    group: "image",
    title: "영상 feature",
    fields: [
      { key: "redness_score", label: "Redness score", step: "0.1" },
      { key: "crack_score", label: "Crack score", step: "0.1" },
      { key: "callus_score", label: "Callus score", step: "0.1" },
      { key: "wound_presence_score", label: "Wound presence score", step: "0.1" },
      { key: "discoloration_score", label: "Discoloration score", step: "0.1" },
      { key: "toe_dorsal_abnormality_score", label: "Toe dorsal abnormality score", step: "0.1" },
    ],
  },
  {
    group: "pressure",
    title: "압력/보행 feature",
    fields: [
      { key: "peak_plantar_pressure", label: "Peak plantar pressure", step: "0.1" },
      { key: "pressure_time_integral", label: "Pressure time integral", step: "0.1" },
      { key: "pressure_asymmetry_index", label: "Pressure asymmetry index", step: "0.01" },
      { key: "step_count", label: "Step count", step: "1" },
      { key: "gait_asymmetry_index", label: "Gait asymmetry index", step: "0.01" },
      { key: "offloading_adherence_score", label: "Offloading adherence score", step: "0.01" },
    ],
  },
  {
    group: "fiber",
    title: "섬유형 센서 feature",
    fields: [
      {
        key: "toe_temp_profile",
        label: "Toe temp profile",
        type: "array",
        placeholder: "예: 32.1|32.4|32.0",
      },
      {
        key: "dorsal_temp_profile",
        label: "Dorsal temp profile",
        type: "array",
        placeholder: "예: 31.8|32.0|31.9",
      },
      {
        key: "plantar_temp_profile",
        label: "Plantar temp profile",
        type: "array",
        placeholder: "예: 33.5|33.1|32.9",
      },
      {
        key: "local_pressure_cluster",
        label: "Local pressure cluster",
        type: "array",
        placeholder: "예: 12|18|17|14",
      },
      {
        key: "sustained_pressure_duration",
        label: "Sustained pressure duration",
        type: "number",
        step: "0.1",
        placeholder: "예: 24.5",
      },
    ],
  },
];

const RULE_SIGNAL_FIELDS = [
  { key: "perfusion_low", label: "Perfusion low" },
  { key: "temp_asymmetry", label: "Temperature asymmetry" },
  { key: "pressure_high", label: "Pressure high" },
  { key: "callus_score_high", label: "Callus score high" },
  { key: "history_score_high", label: "History score high" },
  { key: "hotspot_persistence", label: "Hotspot persistence" },
];

const BOOLEAN_OPTIONS = [
  { value: "TRUE", label: "예" },
  { value: "FALSE", label: "아니오" },
];

const state = {
  records: [],
  selectedRecordId: null,
  form: createInitialForm(),
  saveMessage: "",
  csvMessage: "",
  csvPreviewRows: [],
  csvIgnoredCount: 0,
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
  } else if (action === "set-rule") {
    state.form.ruleSignals[target.dataset.field] = target.dataset.value === "TRUE";
    state.saveMessage = "";
  } else if (action === "download-csv-template") {
    downloadCsvTemplate();
  } else if (action === "save-sensor") {
    await saveSensorData();
  } else if (action === "export-record") {
    const record = getSelectedRecord();
    if (record) {
      exportResearchRecord(record);
    }
  }

  render();
});

root.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }

  const { section, group, field, type } = target.dataset;
  if (!field) {
    return;
  }

  if (section === "timeSeries") {
    state.form.timeSeries[field] = parseNumberOrNull(target.value);
  } else if (section === "sensor" && group) {
    state.form.sensor[group][field] =
      type === "array" ? parseArrayOrNull(target.value) : parseNumberOrNull(target.value);
  }

  state.saveMessage = "";
});

root.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.type === "file" && target.dataset.action === "upload-csv") {
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const result = applyCsvToForm(text);
    state.csvMessage =
      result.appliedCount > 0
        ? `CSV에서 ${result.appliedCount}개 필드를 반영했습니다.${result.ignoredCount ? ` 인식되지 않은 항목 ${result.ignoredCount}개는 제외했습니다.` : ""} 저장 버튼을 눌러 레코드에 반영해 주세요.`
        : "인식된 CSV 필드가 없습니다. 헤더명이 feature 키와 일치하는지 확인해 주세요.";
    state.csvPreviewRows = result.previewRows;
    state.csvIgnoredCount = result.ignoredCount;
    state.saveMessage = "";
    render();
  }
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
  if (selected) {
    state.form = {
      timeSeries: structuredClone(selected.aiFeatureGroups.timeSeries ?? createInitialLongitudinalFeatures()),
      sensor: structuredClone(selected.aiFeatureGroups.sensor ?? createInitialSensorFeatureBundle()),
      ruleSignals: structuredClone(selected.ruleFusionSignals ?? createInitialRuleFusionSignals()),
    };
  } else {
    state.form = createInitialForm();
  }

  state.saveMessage = "";
  state.csvMessage = "";
  state.csvPreviewRows = [];
  state.csvIgnoredCount = 0;
}

function getSelectedRecord() {
  if (!state.selectedRecordId) {
    return null;
  }

  return state.records.find((record) => record.recordId === state.selectedRecordId) ?? null;
}

async function saveSensorData() {
  const selected = getSelectedRecord();
  if (!selected) {
    return;
  }

  const updated = structuredClone(selected);
  updated.aiFeatureGroups.timeSeries = structuredClone(state.form.timeSeries);
  updated.aiFeatureGroups.sensor = structuredClone(state.form.sensor);
  updated.ruleFusionSignals = structuredClone(state.form.ruleSignals);
  updated.ruleFusionFlags = buildRuleBasedFusionFlags(
    updated.aiFeatureGroups.static,
    updated.ruleFusionSignals,
  );

  const saved = await updateSavedResearchRecord(selected.recordId, updated);
  if (saved) {
    state.saveMessage = "센서 측정 결과와 규칙기반 신호가 저장되었습니다.";
    await refreshRecords();
  }
}

function applyCsvToForm(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { appliedCount: 0, previewRows: [], ignoredCount: 0 };
  }

  let appliedCount = 0;
  let ignoredCount = 0;
  const previewRows = [];
  const firstCells = splitCsvLine(lines[0]).map((cell) => cell.trim());

  if (firstCells.length >= 2 && ["field", "key", "feature"].includes(firstCells[0].toLowerCase())) {
    for (const line of lines.slice(1)) {
      const [rawKey, rawValue = ""] = splitCsvLine(line);
      const applied = applyCsvEntry(rawKey, rawValue);
      if (applied) {
        previewRows.push(applied);
        appliedCount += 1;
      } else {
        ignoredCount += 1;
      }
    }
    return { appliedCount, previewRows, ignoredCount };
  }

  if (lines.length >= 2) {
    const headers = firstCells;
    const values = splitCsvLine(lines[1]);
    headers.forEach((header, index) => {
      const applied = applyCsvEntry(header, values[index] ?? "");
      if (applied) {
        previewRows.push(applied);
        appliedCount += 1;
      } else {
        ignoredCount += 1;
      }
    });
  }

  return { appliedCount, previewRows, ignoredCount };
}

function applyCsvEntry(rawKey, rawValue) {
  const normalizedKey = normalizeCsvKey(rawKey);
  const mapping = CSV_FIELD_MAP[normalizedKey];
  if (!mapping) {
    return null;
  }

  if (mapping.kind === "timeSeries") {
    const parsed = parseNumberOrNull(rawValue);
    state.form.timeSeries[mapping.key] = parsed;
    return { field: mapping.key, target: "timeSeries", value: formatPreviewValue(parsed) };
  }

  if (mapping.kind === "rule") {
    const parsed = parseBooleanLoose(rawValue);
    if (parsed === null) {
      return null;
    }
    state.form.ruleSignals[mapping.key] = parsed;
    return { field: mapping.key, target: "ruleSignals", value: formatPreviewValue(parsed) };
  }

  const parsed =
    mapping.type === "array" ? parseArrayOrNull(rawValue) : parseNumberOrNull(rawValue);
  state.form.sensor[mapping.group][mapping.key] = parsed;
  return {
    field: mapping.key,
    target: `sensor.${mapping.group}`,
    value: formatPreviewValue(parsed),
  };
}

function render() {
  const selected = getSelectedRecord();
  root.innerHTML = `
    <main class="app-shell">
      <aside class="side-panel">
        <section class="hero-card">
          <p class="eyebrow">Sensor Console</p>
          <h1>센서 측정 결과 입력</h1>
          <p>동일한 연구 레코드에 센서 feature를 직접 입력하거나 CSV로 업로드할 수 있습니다.</p>
        </section>
        <section class="progress-card">
          <p class="eyebrow tint">저장된 레코드</p>
          <p class="metric-value">${state.records.length}</p>
          <div class="button-row compact top-gap">
            <button class="secondary-button small" data-action="refresh-records">목록 새로고침</button>
            <a class="secondary-button small link-button" href="./clinician.html">의사 측정 화면</a>
            <a class="secondary-button small link-button" href="./admin.html">관리자 페이지</a>
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
              <span class="badge">Sensor Data</span>
              <span class="badge soft">Direct Input + CSV</span>
            </div>
            <div class="top-copyright">Copyright 2026 Wiregene Co., Ltd.</div>
          </div>
          <div class="panel-heading">
            <div>
              <p class="step-caption">센서 입력 화면</p>
              <h2>${selected ? "센서 측정 결과 입력" : "먼저 환자 레코드를 선택해 주세요"}</h2>
              <p class="step-description">
                ${
                  selected
                    ? "광학, 열영상, 영상, 압력/보행, 섬유형 센서와 시계열 변화량을 한 레코드에 묶어 저장합니다."
                    : "환자 문진을 먼저 제출한 뒤 이 화면에서 해당 레코드를 선택해 센서 데이터를 연결할 수 있습니다."
                }
              </p>
            </div>
          </div>
          ${state.saveMessage ? `<div class="save-banner">${escapeHtml(state.saveMessage)}</div>` : ""}
          ${state.csvMessage ? `<div class="summary-banner">${escapeHtml(state.csvMessage)}</div>` : ""}
        </header>
        <div class="panel-body">
          ${selected ? renderSelectedRecord(selected) : renderEmptyState()}
        </div>
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
      <p>먼저 환자 문진을 완료하면 센서 결과를 이 화면에서 연결할 수 있습니다.</p>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <section class="empty-card large">
      <strong>선택된 레코드가 없습니다.</strong>
      <p>환자 문진을 먼저 완료한 뒤 센서 입력 화면을 다시 열어 주세요.</p>
    </section>
  `;
}

function renderSelectedRecord(record) {
  const demographics = record.questionnairePayload?.questionnaireData?.demographics ?? {};
  return `
    <section class="summary-card">
      <div class="summary-head">
        <div>
          <p class="step-caption">연구 레코드</p>
          <h3>${escapeHtml(record.recordId)}</h3>
        </div>
        <button class="secondary-button small" data-action="export-record">JSON 내보내기</button>
      </div>
      <div class="summary-grid three">
        ${summaryItem("제출 시각", formatDateTime(record.patientSummary.submittedAt))}
        ${summaryItem("환자 이름", demographics.fullName || "미입력")}
        ${summaryItem("휴대폰 번호", formatPhoneNumber(demographics.phoneNumber))}
        ${summaryItem("이메일", demographics.emailAddress || "미입력")}
        ${summaryItem("환자 요약", `${record.patientSummary.sex} · ${record.patientSummary.age}세`)}
        ${summaryItem("문진 Risk", `App Risk ${record.patientSummary.appRiskClass}`)}
        ${summaryItem("Confirmed Risk", riskLabel(record.clinicianMeasurements?.iwgdf_confirmed_risk_class))}
        ${summaryItem("Sensor group count", `${Object.keys(record.aiFeatureGroups.sensor).length}개`) }
        ${summaryItem("Time-series field count", `${Object.keys(record.aiFeatureGroups.timeSeries).length}개`) }
      </div>
    </section>

    <section class="question-card">
      <div class="question-head">
        <h3>CSV 업로드</h3>
        <span class="required-pill optional">선택</span>
      </div>
      <p class="hint-text"><code>field,value</code> 형식 또는 헤더 1행 + 값 1행 형식을 지원합니다. 배열 값은 <code>|</code> 로 구분해 주세요.</p>
      <div class="button-row compact top-gap">
        <button class="secondary-button small" data-action="download-csv-template">CSV 샘플 다운로드</button>
      </div>
      <div class="upload-box top-gap">
        <input type="file" accept=".csv,text/csv" data-action="upload-csv" />
      </div>
      <div class="mono-box top-gap">예시: field,value / perfusion_index,0.62 / toe_temp_profile,32.1|32.4|32.0</div>
      ${renderCsvPreview()}
    </section>

    <section class="question-card">
      <div class="question-head">
        <h3>시계열 feature 직접 입력</h3>
        <span class="required-pill optional">직접 입력</span>
      </div>
      <div class="clinician-grid">
        ${TIME_SERIES_FIELDS.map((field) => renderNumberField("timeSeries", "", field, state.form.timeSeries[field.key])).join("")}
      </div>
    </section>

    ${SENSOR_GROUPS.map((group) => renderSensorGroup(group)).join("")}

    <section class="question-card">
      <div class="question-head">
        <h3>규칙기반 결합 신호</h3>
        <span class="required-pill optional">직접 입력</span>
      </div>
      <div class="clinician-grid">
        ${RULE_SIGNAL_FIELDS.map((field) => renderRuleField(field)).join("")}
      </div>
      <div class="button-row top-gap">
        <button class="primary-button dark" data-action="save-sensor">센서 결과 저장</button>
      </div>
    </section>
  `;
}

function renderSensorGroup(group) {
  return `
    <section class="question-card">
      <div class="question-head">
        <h3>${escapeHtml(group.title)}</h3>
        <span class="required-pill optional">직접 입력</span>
      </div>
      <div class="clinician-grid">
        ${group.fields.map((field) => {
          const currentValue = state.form.sensor[group.group][field.key];
          return field.type === "array"
            ? renderArrayField(group.group, field, currentValue)
            : renderNumberField("sensor", group.group, field, currentValue);
        }).join("")}
      </div>
    </section>
  `;
}

function renderNumberField(section, group, field, currentValue) {
  return `
    <article class="field-card">
      <strong>${escapeHtml(field.label)}</strong>
      <label class="number-field top-gap">
        <input
          type="number"
          inputmode="decimal"
          step="${field.step ?? "0.01"}"
          data-section="${section}"
          data-group="${group}"
          data-field="${field.key}"
          data-type="number"
          value="${escapeAttribute(currentValue ?? "")}"
          placeholder="${escapeAttribute(field.placeholder ?? "수치 입력")}"
        />
        <span>입력</span>
      </label>
    </article>
  `;
}

function renderArrayField(group, field, currentValue) {
  return `
    <article class="field-card">
      <strong>${escapeHtml(field.label)}</strong>
      <label class="textarea-field top-gap">
        <textarea
          rows="3"
          data-section="sensor"
          data-group="${group}"
          data-field="${field.key}"
          data-type="array"
          placeholder="${escapeAttribute(field.placeholder)}"
        >${escapeHtml(arrayToText(currentValue))}</textarea>
      </label>
      <p class="helper-text">값은 <code>|</code> 또는 <code>,</code> 로 구분해 입력할 수 있습니다.</p>
    </article>
  `;
}

function renderRuleField(field) {
  const currentValue = state.form.ruleSignals[field.key];
  return `
    <article class="field-card">
      <strong>${escapeHtml(field.label)}</strong>
      <div class="choice-grid cols-2 top-gap">
        ${BOOLEAN_OPTIONS.map((option) => `
          <button
            class="choice-button ${isRuleSelected(currentValue, option.value) ? "selected" : ""}"
            data-action="set-rule"
            data-field="${field.key}"
            data-value="${option.value}"
          >
            <strong>${escapeHtml(option.label)}</strong>
          </button>
        `).join("")}
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

function renderCsvPreview() {
  if (!state.csvPreviewRows.length) {
    return "";
  }

  return `
    <div class="preview-table-wrap top-gap">
      <table class="preview-table">
        <thead>
          <tr>
            <th>CSV field</th>
            <th>반영 위치</th>
            <th>읽은 값</th>
          </tr>
        </thead>
        <tbody>
          ${state.csvPreviewRows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.field)}</td>
                  <td>${escapeHtml(row.target)}</td>
                  <td>${escapeHtml(row.value)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function createInitialForm() {
  return {
    timeSeries: createInitialLongitudinalFeatures(),
    sensor: createInitialSensorFeatureBundle(),
    ruleSignals: createInitialRuleFusionSignals(),
  };
}

function parseNumberOrNull(value) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseArrayOrNull(value) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const parsed = trimmed
    .split(/[|,;]/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

  return parsed.length ? parsed : null;
}

function formatPreviewValue(value) {
  if (Array.isArray(value)) {
    return value.join("|");
  }
  if (value === null || value === undefined || value === "") {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function parseBooleanLoose(value) {
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "예"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "아니오"].includes(normalized)) {
    return false;
  }
  return null;
}

function splitCsvLine(line) {
  return line.split(",").map((cell) => cell.trim());
}

function normalizeCsvKey(key) {
  return String(key)
    .trim()
    .toLowerCase()
    .replace(/^sensor\./, "")
    .replace(/^timeseries\./, "")
    .replace(/^rulefusionsignals\./, "")
    .split(".")
    .pop();
}

function arrayToText(value) {
  return Array.isArray(value) ? value.join("|") : "";
}

function downloadCsvTemplate() {
  const rows = [["field", "value"]];

  TIME_SERIES_FIELDS.forEach((field) => {
    rows.push([field.key, ""]);
  });

  SENSOR_GROUPS.forEach((group) => {
    group.fields.forEach((field) => {
      rows.push([field.key, field.type === "array" ? "0.0|0.0|0.0" : ""]);
    });
  });

  RULE_SIGNAL_FIELDS.forEach((field) => {
    rows.push([field.key, "false"]);
  });

  const csv = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wiregene-sensor-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function isRuleSelected(currentValue, optionValue) {
  return optionValue === "TRUE" ? currentValue === true : currentValue === false;
}

function riskLabel(value) {
  return value === null || value === undefined ? "미정" : `Risk ${value}`;
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

const CSV_FIELD_MAP = buildCsvFieldMap();

function buildCsvFieldMap() {
  const map = {};

  TIME_SERIES_FIELDS.forEach((field) => {
    map[field.key] = { kind: "timeSeries", key: field.key };
  });

  SENSOR_GROUPS.forEach((group) => {
    group.fields.forEach((field) => {
      map[field.key] = {
        kind: "sensor",
        group: group.group,
        key: field.key,
        type: field.type === "array" ? "array" : "number",
      };
    });
  });

  RULE_SIGNAL_FIELDS.forEach((field) => {
    map[field.key] = { kind: "rule", key: field.key };
  });

  return map;
}
