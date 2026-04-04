export const SNAPSHOT_FORMAT = "wiregene-diabetic-foot-demo-db-v3";

export function createRecordId(isoTime) {
  const compact = String(isoTime ?? new Date().toISOString())
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replaceAll(".", "");

  return `WG-DFS-DEMO-${compact.slice(0, 15)}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

export function isLikelyResearchRecord(record) {
  return Boolean(
    record &&
      typeof record === "object" &&
      record.questionnairePayload &&
      record.questionnairePayload.questionnaireData,
  );
}

export function normalizeResearchRecord(record, { preserveMeta = true } = {}) {
  if (!isLikelyResearchRecord(record)) {
    return null;
  }

  const cloned = structuredClone(record);
  const submittedAt =
    cloned?.questionnairePayload?.submittedAt ??
    cloned?.updatedAt ??
    cloned?.createdAt ??
    new Date().toISOString();
  const createdAt = preserveMeta ? cloned.createdAt ?? submittedAt : submittedAt;
  const updatedAt = preserveMeta ? cloned.updatedAt ?? submittedAt : submittedAt;
  const recordId = cloned.recordId ?? createRecordId(submittedAt);

  return {
    ...cloned,
    recordId,
    createdAt,
    updatedAt,
    patientSummary: buildPatientSummary(cloned),
  };
}

export function normalizeImportedRecords(parsed) {
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
      .map((record) => normalizeResearchRecord(record))
      .filter(Boolean),
  );
}

export function createResearchDatabaseSnapshot(records) {
  const normalized = sortRecords(
    records
      .map((record) => normalizeResearchRecord(record))
      .filter(Boolean),
  );

  return {
    format: SNAPSHOT_FORMAT,
    exportedAt: new Date().toISOString(),
    recordCount: normalized.length,
    records: normalized,
  };
}

export function sortRecords(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? 0);
    const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? 0);
    return rightTime - leftTime;
  });
}

export function buildPatientSummary(record) {
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
