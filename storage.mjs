const STORAGE_KEY = "wiregene-diabetic-foot-demo-records";
const SNAPSHOT_FORMAT = "wiregene-diabetic-foot-demo-db-v2";

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
  writeRecords(sortRecords(records));
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
  writeRecords(sortRecords(records));
  return updatedRecord;
}

export async function deleteSavedResearchRecord(recordId) {
  const records = readRecords();
  const nextRecords = records.filter((record) => record.recordId !== recordId);

  if (nextRecords.length === records.length) {
    return false;
  }

  writeRecords(sortRecords(nextRecords));
  return true;
}

export function exportResearchRecord(record) {
  downloadJson(`${record.recordId}.json`, record);
}

export function exportResearchDatabaseSnapshot() {
  const records = readRecords();
  const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");

  downloadJson(
    `wiregene-diabetic-foot-demo-database-${timestamp}.json`,
    {
      format: SNAPSHOT_FORMAT,
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      records,
    },
  );
}

export async function importResearchDatabaseSnapshot(
  rawText,
  { mode = "merge" } = {},
) {
  const currentRecords = readRecords();
  const importedRecords = normalizeImportedRecords(JSON.parse(rawText));

  if (!importedRecords.length) {
    return {
      importedCount: 0,
      replacedCount: 0,
      skippedCount: 0,
      totalCount: currentRecords.length,
      mode,
      message: "가져올 수 있는 연구 record가 없습니다.",
    };
  }

  if (mode === "replace") {
    const nextRecords = sortRecords(importedRecords);
    writeRecords(nextRecords);
    return {
      importedCount: nextRecords.length,
      replacedCount: nextRecords.length,
      skippedCount: 0,
      totalCount: nextRecords.length,
      mode,
      message: `${nextRecords.length}개의 record로 브라우저 DB를 교체했습니다.`,
    };
  }

  const mergedById = new Map(currentRecords.map((record) => [record.recordId, record]));
  let replacedCount = 0;
  let addedCount = 0;

  for (const record of importedRecords) {
    if (mergedById.has(record.recordId)) {
      replacedCount += 1;
    } else {
      addedCount += 1;
    }
    mergedById.set(record.recordId, record);
  }

  const nextRecords = sortRecords(Array.from(mergedById.values()));
  writeRecords(nextRecords);

  return {
    importedCount: importedRecords.length,
    replacedCount,
    skippedCount: 0,
    addedCount,
    totalCount: nextRecords.length,
    mode,
    message:
      replacedCount > 0
        ? `${importedRecords.length}개의 record를 병합했습니다. 기존 ${replacedCount}개는 최신 JSON으로 갱신했습니다.`
        : `${importedRecords.length}개의 record를 브라우저 DB에 병합했습니다.`,
  };
}

function readRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortRecords(
      parsed
        .filter(isLikelyResearchRecord)
        .map((record) => ({
          ...structuredClone(record),
          patientSummary: buildPatientSummary(record),
        })),
    );
  } catch {
    return [];
  }
}

function writeRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeImportedRecords(parsed) {
  const candidates = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.records)
      ? parsed.records
      : isLikelyResearchRecord(parsed)
        ? [parsed]
        : [];

  return sortRecords(
    candidates
      .filter(isLikelyResearchRecord)
      .map((record) => normalizeImportedRecord(record)),
  );
}

function normalizeImportedRecord(record) {
  const cloned = structuredClone(record);
  const submittedAt =
    cloned?.questionnairePayload?.submittedAt ??
    cloned?.createdAt ??
    new Date().toISOString();

  return {
    ...cloned,
    recordId: cloned.recordId ?? createRecordId(submittedAt),
    createdAt: cloned.createdAt ?? submittedAt,
    updatedAt: cloned.updatedAt ?? submittedAt,
    patientSummary: buildPatientSummary(cloned),
  };
}

function isLikelyResearchRecord(record) {
  return Boolean(
    record &&
      typeof record === "object" &&
      record.questionnairePayload &&
      record.questionnairePayload.questionnaireData,
  );
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? 0);
    const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? 0);
    return rightTime - leftTime;
  });
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createRecordId(isoTime) {
  const compact = isoTime.replaceAll("-", "").replaceAll(":", "").replaceAll(".", "");
  return `WG-DFS-DEMO-${compact.slice(0, 15)}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function buildPatientSummary(record) {
  const questionnaire = record?.questionnairePayload?.questionnaireData;
  const demographics = questionnaire?.demographics ?? {};

  return {
    submittedAt: record?.questionnairePayload?.submittedAt ?? record?.updatedAt ?? null,
    age: demographics.age || "미입력",
    sex: genderLabel(demographics.gender),
    nameMasked: maskName(demographics.fullName),
    phoneMasked: maskPhoneNumber(demographics.phoneNumber),
    emailMasked: maskEmailAddress(demographics.emailAddress),
    appRiskClass: record?.questionnairePayload?.internalScores?.app_risk_class ?? 0,
    activeConcern:
      record?.questionnairePayload?.internalFlags?.active_concerning_foot_symptom ?? false,
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
