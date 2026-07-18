import {
  createResearchDatabaseSnapshot,
  normalizeImportedRecords,
  normalizeResearchRecord,
  sortRecords,
} from "./record-utils.mjs";

const DRIVE_API_BASE = "https://www.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function createGoogleDriveRepository(config) {
  const client = createGoogleDriveClient(config);

  return {
    storage: {
      kind: "remote",
      label: "Google Drive JSON DB",
      detail: "Node API + Google Drive JSON database",
    },

    async checkReady() {
      return client.checkReady();
    },

    async listRecords() {
      return client.readRecords();
    },

    async getRecord(recordId) {
      const records = await client.readRecords();
      return records.find((record) => record.recordId === recordId) ?? null;
    },

    async upsertRecord(record) {
      const normalized = normalizeResearchRecord(record);
      if (!normalized) {
        throw new Error("Invalid research record.");
      }

      await client.updateRecords((records) => {
        const byId = new Map(records.map((entry) => [entry.recordId, entry]));
        byId.set(normalized.recordId, normalized);
        return sortRecords(Array.from(byId.values()));
      });

      return normalized;
    },

    async deleteRecord(recordId) {
      await client.updateRecords((records) =>
        records.filter((record) => record.recordId !== recordId),
      );
      return true;
    },

    async exportSnapshot() {
      const records = await client.readRecords();
      return createResearchDatabaseSnapshot(records);
    },

    async importSnapshot(snapshot, { mode = "merge" } = {}) {
      const importedRecords = normalizeImportedRecords(snapshot);
      const currentRecords = await client.readRecords();

      if (!importedRecords.length) {
        return {
          importedCount: 0,
          replacedCount: 0,
          skippedCount: 0,
          totalCount: currentRecords.length,
          mode,
          message: "No valid records found in the imported snapshot.",
        };
      }

      if (mode === "replace") {
        await client.writeRecords(importedRecords);
        return {
          importedCount: importedRecords.length,
          replacedCount: importedRecords.length,
          skippedCount: 0,
          totalCount: importedRecords.length,
          mode,
          message: `${importedRecords.length} records replaced the Google Drive DB.`,
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

      const byId = new Map(currentRecords.map((record) => [record.recordId, record]));
      for (const record of importedRecords) {
        byId.set(record.recordId, record);
      }

      const nextRecords = sortRecords(Array.from(byId.values()));
      await client.writeRecords(nextRecords);

      return {
        importedCount: importedRecords.length,
        replacedCount,
        skippedCount: 0,
        addedCount,
        totalCount: nextRecords.length,
        mode,
        message: `${importedRecords.length} records merged into the Google Drive DB.`,
      };
    },
  };
}

function createGoogleDriveClient(config) {
  let accessToken = "";
  let accessTokenExpiresAt = 0;
  let databaseFileId = extractGoogleDriveFileId(config.googleDriveDatabaseFileId);
  let folderId = extractGoogleDriveFileId(config.googleDriveFolderId);

  return {
    async checkReady() {
      const signal = AbortSignal.timeout(8_000);
      const fileId = databaseFileId || (await findExistingDatabaseFileId(signal));
      if (!fileId) {
        throw new Error("Google Drive database file is not ready.");
      }
      databaseFileId = fileId;
      await driveJson(
        `${DRIVE_API_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?fields=id&supportsAllDrives=true`,
        { signal },
      );
      return true;
    },

    async readRecords() {
      const database = await readDatabase();
      return sortRecords(normalizeImportedRecords(database));
    },

    async writeRecords(records) {
      const snapshot = createResearchDatabaseSnapshot(records);
      await writeDatabase(snapshot);
    },

    async updateRecords(updater) {
      const records = await this.readRecords();
      await this.writeRecords(updater(records));
    },
  };

  async function readDatabase() {
    const fileId = await resolveDatabaseFileId();
    const response = await driveFetch(
      `${DRIVE_API_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    );
    const text = await response.text();
    if (!text.trim()) {
      return createResearchDatabaseSnapshot([]);
    }
    return JSON.parse(text);
  }

  async function writeDatabase(snapshot) {
    const fileId = await resolveDatabaseFileId();
    await driveFetch(
      `${DRIVE_API_BASE}/upload/drive/v3/files/${encodeURIComponent(
        fileId,
      )}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(snapshot, null, 2),
      },
    );
  }

  async function resolveDatabaseFileId() {
    if (databaseFileId) {
      return databaseFileId;
    }

    const parentId = await resolveFolderId();
    const filename = config.googleDriveDatabaseFilename;
    const parentQuery = parentId ? `'${escapeDriveQuery(parentId)}' in parents` : "";
    const query = [
      `name = '${escapeDriveQuery(filename)}'`,
      "trashed = false",
      parentQuery,
    ]
      .filter(Boolean)
      .join(" and ");
    const searchUrl = new URL(`${DRIVE_API_BASE}/drive/v3/files`);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("fields", "files(id,name,modifiedTime)");
    searchUrl.searchParams.set("orderBy", "modifiedTime desc");
    searchUrl.searchParams.set("pageSize", "1");
    searchUrl.searchParams.set("supportsAllDrives", "true");
    searchUrl.searchParams.set("includeItemsFromAllDrives", "true");

    const searchResult = await driveJson(searchUrl);
    databaseFileId = searchResult.files?.[0]?.id ?? "";
    if (databaseFileId) {
      return databaseFileId;
    }

    databaseFileId = await createDatabaseFile(parentId);
    return databaseFileId;
  }

  async function findExistingDatabaseFileId(signal) {
    let readinessFolderId = folderId;
    if (!readinessFolderId && config.googleDriveFolderName) {
      const folderSearchUrl = new URL(`${DRIVE_API_BASE}/drive/v3/files`);
      folderSearchUrl.searchParams.set(
        "q",
        [
          `name = '${escapeDriveQuery(config.googleDriveFolderName)}'`,
          "mimeType = 'application/vnd.google-apps.folder'",
          "trashed = false",
        ].join(" and "),
      );
      folderSearchUrl.searchParams.set("fields", "files(id)");
      folderSearchUrl.searchParams.set("pageSize", "1");
      folderSearchUrl.searchParams.set("supportsAllDrives", "true");
      folderSearchUrl.searchParams.set("includeItemsFromAllDrives", "true");
      const folderSearchResult = await driveJson(folderSearchUrl, { signal });
      readinessFolderId = folderSearchResult.files?.[0]?.id ?? "";
      if (!readinessFolderId) {
        return "";
      }
    }

    const fileQuery = [
      `name = '${escapeDriveQuery(config.googleDriveDatabaseFilename)}'`,
      "trashed = false",
      readinessFolderId ? `'${escapeDriveQuery(readinessFolderId)}' in parents` : "",
    ]
      .filter(Boolean)
      .join(" and ");
    const fileSearchUrl = new URL(`${DRIVE_API_BASE}/drive/v3/files`);
    fileSearchUrl.searchParams.set("q", fileQuery);
    fileSearchUrl.searchParams.set("fields", "files(id)");
    fileSearchUrl.searchParams.set("pageSize", "1");
    fileSearchUrl.searchParams.set("supportsAllDrives", "true");
    fileSearchUrl.searchParams.set("includeItemsFromAllDrives", "true");
    const fileSearchResult = await driveJson(fileSearchUrl, { signal });
    return fileSearchResult.files?.[0]?.id ?? "";
  }

  async function resolveFolderId() {
    if (folderId) {
      return folderId;
    }

    const folderName = config.googleDriveFolderName;
    if (!folderName) {
      return "";
    }

    const searchUrl = new URL(`${DRIVE_API_BASE}/drive/v3/files`);
    searchUrl.searchParams.set(
      "q",
      [
        `name = '${escapeDriveQuery(folderName)}'`,
        "mimeType = 'application/vnd.google-apps.folder'",
        "trashed = false",
      ].join(" and "),
    );
    searchUrl.searchParams.set("fields", "files(id,name,modifiedTime)");
    searchUrl.searchParams.set("orderBy", "modifiedTime desc");
    searchUrl.searchParams.set("pageSize", "1");
    searchUrl.searchParams.set("supportsAllDrives", "true");
    searchUrl.searchParams.set("includeItemsFromAllDrives", "true");

    const searchResult = await driveJson(searchUrl);
    folderId = searchResult.files?.[0]?.id ?? "";
    if (folderId) {
      return folderId;
    }

    const created = await driveJson(`${DRIVE_API_BASE}/drive/v3/files?fields=id,name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    folderId = created.id;
    return folderId;
  }

  async function createDatabaseFile(parentId) {
    const metadata = {
      name: config.googleDriveDatabaseFilename,
      mimeType: "application/json",
      ...(parentId ? { parents: [parentId] } : {}),
    };
    const snapshot = createResearchDatabaseSnapshot([]);
    const boundary = `wiregene-${Date.now().toString(36)}`;
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(snapshot, null, 2),
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const created = await driveJson(
      `${DRIVE_API_BASE}/upload/drive/v3/files?uploadType=multipart&fields=id,name`,
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    return created.id;
  }

  async function driveJson(url, options = {}) {
    const response = await driveFetch(url, options);
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function driveFetch(url, options = {}) {
    const token = await getAccessToken(options.signal);
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(await readGoogleError(response));
    }

    return response;
  }

  async function getAccessToken(signal) {
    if (accessToken && Date.now() < accessTokenExpiresAt - 60_000) {
      return accessToken;
    }

    const body = new URLSearchParams({
      client_id: config.googleDriveClientId,
      client_secret: config.googleDriveClientSecret,
      refresh_token: config.googleDriveRefreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(await readGoogleError(response));
    }

    const payload = await response.json();
    accessToken = payload.access_token;
    accessTokenExpiresAt = Date.now() + Number(payload.expires_in ?? 3600) * 1000;
    return accessToken;
  }
}

async function readGoogleError(response) {
  const fallback = `Google Drive API error ${response.status}`;
  try {
    const payload = await response.json();
    return payload?.error?.message || payload?.error_description || fallback;
  } catch {
    return fallback;
  }
}

function extractGoogleDriveFileId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const foldersMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch) {
    return foldersMatch[1];
  }

  const fileMatch = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return fileMatch[1];
  }

  const idMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return idMatch[1];
  }

  return raw;
}

function escapeDriveQuery(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
