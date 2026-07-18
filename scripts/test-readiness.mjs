import assert from "node:assert/strict";

import { createGoogleDriveRepository } from "../google-drive-rest.mjs";
import { createSupabaseRepository } from "../supabase-rest.mjs";

const originalFetch = globalThis.fetch;

try {
  await testSupabaseReadiness();
  await testGoogleDriveReadiness();
  await testGoogleDriveReadinessWithoutFileId();
  console.log("Readiness probe tests passed.");
} finally {
  globalThis.fetch = originalFetch;
}

async function testSupabaseReadiness() {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), signal: options.signal });
    return Response.json([]);
  };

  const repository = createSupabaseRepository({
    supabaseUrl: "https://example.supabase.co",
    supabaseServiceRoleKey: "ci-only-key",
  });

  await repository.checkReady();

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /select=record_id&limit=1/);
  assert.ok(calls[0].signal instanceof AbortSignal);
  assert.doesNotMatch(calls[0].url, /record_payload/);
}

async function testGoogleDriveReadiness() {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    calls.push({ url: requestUrl, signal: options.signal });
    if (requestUrl.includes("oauth2.googleapis.com")) {
      return Response.json({ access_token: "ci-token", expires_in: 3600 });
    }
    return Response.json({ id: "file123" });
  };

  const repository = createGoogleDriveRepository({
    googleDriveClientId: "ci-client",
    googleDriveClientSecret: "ci-secret",
    googleDriveRefreshToken: "ci-refresh",
    googleDriveDatabaseFileId: "file123",
    googleDriveFolderId: "",
    googleDriveFolderName: "",
    googleDriveDatabaseFilename: "db.json",
  });

  await repository.checkReady();

  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /fields=id/);
  assert.doesNotMatch(calls[1].url, /alt=media/);
  assert.ok(calls[0].signal instanceof AbortSignal);
  assert.ok(calls[1].signal instanceof AbortSignal);
}

async function testGoogleDriveReadinessWithoutFileId() {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    calls.push({ url: requestUrl, method: options.method ?? "GET", signal: options.signal });
    if (requestUrl.includes("oauth2.googleapis.com")) {
      return Response.json({ access_token: "ci-token", expires_in: 3600 });
    }
    if (requestUrl.includes("mimeType")) {
      return Response.json({ files: [{ id: "folder123" }] });
    }
    if (requestUrl.includes("q=")) {
      return Response.json({ files: [{ id: "file123" }] });
    }
    return Response.json({ id: "file123" });
  };

  const repository = createGoogleDriveRepository({
    googleDriveClientId: "ci-client",
    googleDriveClientSecret: "ci-secret",
    googleDriveRefreshToken: "ci-refresh",
    googleDriveDatabaseFileId: "",
    googleDriveFolderId: "",
    googleDriveFolderName: "wiregene-ci",
    googleDriveDatabaseFilename: "db.json",
  });

  await repository.checkReady();

  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.signal instanceof AbortSignal));
  assert.ok(calls.every((call) => call.method === "GET" || call.url.includes("oauth2.googleapis.com")));
  assert.ok(calls.every((call) => !call.url.includes("uploadType")));
}
