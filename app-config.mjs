import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadAppConfig(rootDir) {
  loadEnvFile(path.join(rootDir, ".env"));

  return {
    host: process.env.HOST || "0.0.0.0",
    port: Number.parseInt(process.env.PORT || "3000", 10),
    rootDir,
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    adminUsername: process.env.ADMIN_USERNAME || "wiregene-admin",
    adminPassword: process.env.ADMIN_PASSWORD || "WG-demo-2026",
    adminDisplayName: process.env.ADMIN_DISPLAY_NAME || "Wiregene Demo Admin",
    sessionTtlHours: Number.parseInt(process.env.SESSION_TTL_HOURS || "12", 10),
  };
}

export function isSupabaseConfigured(config) {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

function loadEnvFile(filepath) {
  if (!existsSync(filepath)) {
    return;
  }

  const content = readFileSync(filepath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = stripQuotes(rawValue);

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
