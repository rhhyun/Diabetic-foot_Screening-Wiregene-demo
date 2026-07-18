import {
  createResearchDatabaseSnapshot,
  normalizeImportedRecords,
  normalizeResearchRecord,
  sortRecords,
} from "./record-utils.mjs";

export function createSupabaseRepository(config) {
  const restBaseUrl = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1`;

  return {
    async checkReady() {
      await supabaseRequest(restBaseUrl, config, {
        path: "/research_records?select=record_id&limit=1",
        signal: AbortSignal.timeout(8_000),
      });
      return true;
    },

    async listRecords() {
      const rows = await supabaseRequest(restBaseUrl, config, {
        path: "/research_records?select=record_payload&order=updated_at.desc",
      });
      return sortRecords(rows.map(rowToRecord).filter(Boolean));
    },

    async getRecord(recordId) {
      const rows = await supabaseRequest(restBaseUrl, config, {
        path: `/research_records?record_id=eq.${encodeURIComponent(recordId)}&select=record_payload&limit=1`,
      });
      return rowToRecord(rows?.[0]) ?? null;
    },

    async upsertRecord(record) {
      const normalized = normalizeResearchRecord(record);
      if (!normalized) {
        throw new Error("유효한 연구 record 형식이 아닙니다.");
      }

      const rows = await supabaseRequest(restBaseUrl, config, {
        method: "POST",
        path: "/research_records?on_conflict=record_id",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: [recordToRow(normalized)],
      });

      return rowToRecord(rows?.[0]) ?? normalized;
    },

    async deleteRecord(recordId) {
      await supabaseRequest(restBaseUrl, config, {
        method: "DELETE",
        path: `/research_records?record_id=eq.${encodeURIComponent(recordId)}`,
        headers: {
          Prefer: "return=minimal",
        },
      });
      return true;
    },

    async exportSnapshot() {
      const records = await this.listRecords();
      return createResearchDatabaseSnapshot(records);
    },

    async importSnapshot(snapshot, { mode = "merge" } = {}) {
      const importedRecords = normalizeImportedRecords(snapshot);
      const currentRecords = await this.listRecords();

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
        await deleteAllRecords(restBaseUrl, config);
        await bulkUpsert(restBaseUrl, config, importedRecords);
        return {
          importedCount: importedRecords.length,
          replacedCount: importedRecords.length,
          skippedCount: 0,
          totalCount: importedRecords.length,
          mode,
          message: `${importedRecords.length}개의 record로 Supabase 중앙 DB를 교체했습니다.`,
        };
      }

      const currentIds = new Set(currentRecords.map((record) => record.recordId));
      let replacedCount = 0;
      let addedCount = 0;

      for (const record of importedRecords) {
        if (currentIds.has(record.recordId)) {
          replacedCount += 1;
        } else {
          addedCount += 1;
        }
      }

      await bulkUpsert(restBaseUrl, config, importedRecords);

      return {
        importedCount: importedRecords.length,
        replacedCount,
        skippedCount: 0,
        addedCount,
        totalCount: currentRecords.length + addedCount,
        mode,
        message:
          replacedCount > 0
            ? `${importedRecords.length}개의 record를 Supabase 중앙 DB에 병합했고, 기존 ${replacedCount}개를 최신 JSON으로 갱신했습니다.`
            : `${importedRecords.length}개의 record를 Supabase 중앙 DB에 병합했습니다.`,
      };
    },
  };
}

async function bulkUpsert(restBaseUrl, config, records) {
  if (!records.length) {
    return;
  }

  await supabaseRequest(restBaseUrl, config, {
    method: "POST",
    path: "/research_records?on_conflict=record_id",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: records.map(recordToRow),
  });
}

async function deleteAllRecords(restBaseUrl, config) {
  await supabaseRequest(restBaseUrl, config, {
    method: "DELETE",
    path: "/research_records?record_id=not.is.null",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

function recordToRow(record) {
  const normalized = normalizeResearchRecord(record);
  return {
    record_id: normalized.recordId,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    patient_summary: normalized.patientSummary,
    app_risk_class: Number(normalized.patientSummary?.appRiskClass ?? 0),
    active_concern: Boolean(normalized.patientSummary?.activeConcern),
    record_payload: normalized,
  };
}

function rowToRecord(row) {
  return normalizeResearchRecord(row?.record_payload);
}

async function supabaseRequest(
  restBaseUrl,
  config,
  { path, method = "GET", headers = {}, body, signal } = {},
) {
  const response = await fetch(`${restBaseUrl}${path}`, {
    method,
    signal,
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const message = await readSupabaseError(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function readSupabaseError(response) {
  try {
    const payload = await response.json();
    return payload?.message || payload?.hint || `Supabase REST error ${response.status}`;
  } catch {
    return `Supabase REST error ${response.status}`;
  }
}
