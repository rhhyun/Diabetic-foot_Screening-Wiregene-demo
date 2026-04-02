const STORAGE_KEY = "wiregene-diabetic-foot-demo-records";

export async function saveNewResearchRecord(record) {
  const records = readRecords();
  const now = new Date().toISOString();
  const savedRecord = {
    recordId: createRecordId(now),
    createdAt: now,
    updatedAt: now,
    patientSummary: buildPatientSummary(record),
    ...structuredClone(record),
  };

  records.unshift(savedRecord);
  writeRecords(records);
  return savedRecord;
}

export async function listSavedResearchRecords() {
  return readRecords();
}

export async function getSavedResearchRecord(recordId) {
  return readRecords().find((record) => record.recordId === recordId) ?? null;
}

export async function updateSavedResearchRecord(recordId, nextRecord) {
  const records = readRecords();
  const index = records.findIndex((record) => record.recordId === recordId);

  if (index === -1) {
    return null;
  }

  const updatedRecord = {
    ...structuredClone(nextRecord),
    recordId,
    createdAt: records[index].createdAt,
    updatedAt: new Date().toISOString(),
    patientSummary: buildPatientSummary(nextRecord),
  };

  records[index] = updatedRecord;
  writeRecords(records);
  return updatedRecord;
}

export async function deleteSavedResearchRecord(recordId) {
  const records = readRecords();
  const nextRecords = records.filter((record) => record.recordId !== recordId);

  if (nextRecords.length === records.length) {
    return false;
  }

  writeRecords(nextRecords);
  return true;
}

export function exportResearchRecord(record) {
  const blob = new Blob([JSON.stringify(record, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${record.recordId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createRecordId(isoTime) {
  const compact = isoTime.replaceAll("-", "").replaceAll(":", "").replaceAll(".", "");
  return `WG-DFS-DEMO-${compact.slice(0, 15)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function buildPatientSummary(record) {
  const questionnaire = record.questionnairePayload.questionnaireData;
  const demographics = questionnaire.demographics;

  return {
    submittedAt: record.questionnairePayload.submittedAt,
    age: demographics.age || "미입력",
    sex: genderLabel(demographics.gender),
    nameMasked: maskName(demographics.fullName),
    phoneMasked: maskPhoneNumber(demographics.phoneNumber),
    emailMasked: maskEmailAddress(demographics.emailAddress),
    appRiskClass: record.questionnairePayload.internalScores.app_risk_class,
    activeConcern: record.questionnairePayload.internalFlags.active_concerning_foot_symptom,
  };
}

function genderLabel(value) {
  if (value === "MALE") {
    return "남성";
  }
  if (value === "FEMALE") {
    return "여성";
  }
  return "미입력";
}

function maskName(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "미입력";
  }
  if (trimmed.length === 1) {
    return `${trimmed}*`;
  }
  if (trimmed.length === 2) {
    return `${trimmed[0]}*`;
  }
  return `${trimmed[0]}${"*".repeat(Math.max(trimmed.length - 2, 1))}${trimmed.at(-1)}`;
}

function maskPhoneNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    return "미입력";
  }
  if (digits.length < 7) {
    return `${digits.slice(0, 2)}***`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 4)}***-${digits.slice(-4)}`;
}

function maskEmailAddress(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || !trimmed.includes("@")) {
    return "미입력";
  }

  const [localPart, domain] = trimmed.split("@");
  if (!localPart || !domain) {
    return "미입력";
  }

  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(localPart.length - visible.length, 1))}@${domain}`;
}
