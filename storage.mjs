import {
  createRecordId,
  createResearchDatabaseSnapshot,
  normalizeImportedRecords,
  normalizeResearchRecord,
  sortRecords,
} from "./record-utils.mjs";

const STORAGE_KEY = "wiregene-diabetic-foot-demo-records";
const REMOTE_CAPABILITY = {
  checked: false,
  available: false,
  summary: {
    kind: "local",
    label: "Browser localStorage",
    detail: "정적 데모 모드",
  },
};

export async function saveNewResearchRecord(record) {
  if (await shouldUseRemoteStorage()) {
    const saved = await apiRequest("/records", {
      method: "POST",
      body: {
        record,
      },
    });
    return normalizeResearchRecord(saved.record);
  }

  const records = readRecords();
  const now = new Date().toISOString();
  const savedRecord = normalizeResearchRecord(
    {
      ...structuredClone(record),
      recordId: createRecordId(now),
      createdAt: now,
      updatedAt: now,
    },
    { preserveMeta: true },
  );

  records.unshift(savedRecord);
  writeRecords(sortRecords(records));
  return savedRecord;
}

export async function listSavedResearchRecords() {
  if (await shouldUseRemoteStorage()) {
    const response = await apiRequest("/records");
    return sortRecords(
      (response.records ?? [])
        .map((record) => normalizeResearchRecord(record))
        .filter(Boolean),
    );
  }

  return readRecords();
}

export async function getSavedResearchRecord(recordId) {
  if (await shouldUseRemoteStorage()) {
    const response = await apiRequest(`/records/${encodeURIComponent(recordId)}`);
    return normalizeResearchRecord(response.record);
  }

  return readRecords().find((record) => record.recordId === recordId) ?? null;
}

export async function updateSavedResearchRecord(recordId, nextRecord) {
  if (await shouldUseRemoteStorage()) {
    const response = await apiRequest(`/records/${encodeURIComponent(recordId)}`, {
      method: "PUT",
      body: {
        record: nextRecord,
      },
    });
    return normalizeResearchRecord(response.record);
  }

  const records = readRecords();
  const index = records.findIndex((record) => record.recordId === recordId);

  if (index === -1) {
    return null;
  }

  const updatedRecord = normalizeResearchRecord(
    {
      ...structuredClone(nextRecord),
      recordId,
      createdAt: records[index].createdAt,
      updatedAt: new Date().toISOString(),
    },
    { preserveMeta: true },
  );

  records[index] = updatedRecord;
  writeRecords(sortRecords(records));
  return updatedRecord;
}

export async function deleteSavedResearchRecord(recordId) {
  if (await shouldUseRemoteStorage()) {
    const response = await apiRequest(`/records/${encodeURIComponent(recordId)}`, {
      method: "DELETE",
    });
    return Boolean(response.deleted);
  }

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

export async function exportResearchDatabaseSnapshot() {
  if (await shouldUseRemoteStorage()) {
    const snapshot = await apiRequest("/database/export");
    downloadJson(
      `wiregene-diabetic-foot-central-database-${timestampForFilename()}.json`,
      snapshot,
    );
    return snapshot;
  }

  const snapshot = createResearchDatabaseSnapshot(readRecords());
  downloadJson(
    `wiregene-diabetic-foot-demo-database-${timestampForFilename()}.json`,
    snapshot,
  );
  return snapshot;
}

export async function importResearchDatabaseSnapshot(rawText, { mode = "merge" } = {}) {
  if (await shouldUseRemoteStorage()) {
    const snapshot = JSON.parse(rawText);
    return apiRequest("/database/import", {
      method: "POST",
      body: {
        mode,
        snapshot,
      },
    });
  }

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

export async function getStorageBackendStatus({ forceRefresh = false } = {}) {
  await shouldUseRemoteStorage(forceRefresh);
  return structuredClone(REMOTE_CAPABILITY.summary);
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
        .map((record) => normalizeResearchRecord(record))
        .filter(Boolean),
    );
  } catch {
    return [];
  }
}

function writeRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

async function shouldUseRemoteStorage(forceRefresh = false) {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    REMOTE_CAPABILITY.checked = true;
    REMOTE_CAPABILITY.available = false;
    return false;
  }

  if (REMOTE_CAPABILITY.checked && !forceRefresh) {
    return REMOTE_CAPABILITY.available;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(resolveApiUrl("/health"), {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`health check failed: ${response.status}`);
    }

    const payload = await response.json();
    REMOTE_CAPABILITY.checked = true;
    REMOTE_CAPABILITY.available = payload.storage?.kind === "remote";
    REMOTE_CAPABILITY.summary = REMOTE_CAPABILITY.available
      ? {
          kind: "remote",
          label: payload.storage?.label ?? "Supabase central DB",
          detail: payload.storage?.detail ?? "Node API 연결됨",
        }
      : {
          kind: "local",
          label: "Browser localStorage",
          detail: payload.storage?.detail ?? "정적 데모 모드",
        };
  } catch {
    REMOTE_CAPABILITY.checked = true;
    REMOTE_CAPABILITY.available = false;
    REMOTE_CAPABILITY.summary = {
      kind: "local",
      label: "Browser localStorage",
      detail: "Node API 미연결",
    };
  } finally {
    window.clearTimeout(timeoutId);
  }

  return REMOTE_CAPABILITY.available;
}

async function apiRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(resolveApiUrl(path), {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return {};
  }

  return response.json();
}

function resolveApiUrl(path) {
  const base =
    typeof window !== "undefined" && typeof window.WIREGENE_REMOTE_API_BASE === "string"
      ? window.WIREGENE_REMOTE_API_BASE
      : "/api";

  return `${base.replace(/\/$/, "")}${path}`;
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    return payload?.message || `API request failed with ${response.status}`;
  } catch {
    return `API request failed with ${response.status}`;
  }
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

function timestampForFilename() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
}
