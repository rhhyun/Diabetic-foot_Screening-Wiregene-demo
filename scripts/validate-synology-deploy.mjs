import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = Object.fromEntries(
  await Promise.all(
    [
      "Dockerfile",
      "docker-compose.synology.yml",
      "deploy/synology/common-deploy.sh",
      "deploy/synology/deploy.sh",
      "deploy/synology/site.env.example",
      ".github/workflows/publish-container.yml",
      "google-drive-rest.mjs",
      "server.mjs",
    ].map(async (relativePath) => [
      relativePath,
      await readFile(path.join(rootDir, relativePath), "utf8"),
    ]),
  ),
);

const assertIncludes = (relativePath, expected) => {
  if (!files[relativePath].includes(expected)) {
    throw new Error(`${relativePath} is missing required policy: ${expected}`);
  }
};

const assertExcludes = (relativePath, forbiddenPattern) => {
  if (forbiddenPattern.test(files[relativePath])) {
    throw new Error(`${relativePath} contains forbidden deployment behavior: ${forbiddenPattern}`);
  }
};

assertIncludes("Dockerfile", "USER node");
assertIncludes("Dockerfile", 'CMD ["node", "server.mjs"]');
assertIncludes("Dockerfile", "HEALTHCHECK");
assertIncludes("Dockerfile", "npm ci --omit=dev");

assertIncludes("docker-compose.synology.yml", 'image: "${APP_IMAGE:');
assertIncludes("docker-compose.synology.yml", "restart: unless-stopped");
assertIncludes("docker-compose.synology.yml", "healthcheck:");
assertIncludes("docker-compose.synology.yml", 'max-size: "10m"');
assertIncludes("docker-compose.synology.yml", 'max-file: "3"');
assertExcludes("docker-compose.synology.yml", /^\s*build\s*:/m);

assertIncludes("deploy/synology/common-deploy.sh", "mkdir \"$LOCK_DIR\"");
assertIncludes("deploy/synology/common-deploy.sh", "trap cleanup 0");
assertIncludes("deploy/synology/common-deploy.sh", "compose --env-file");
assertIncludes("deploy/synology/common-deploy.sh", "pull --quiet app");
assertIncludes("deploy/synology/common-deploy.sh", "up -d --remove-orphans --no-build");
assertIncludes("deploy/synology/common-deploy.sh", "attempt_automatic_rollback");
assertIncludes("deploy/synology/common-deploy.sh", ".wiregene-deploy-locks");
assertIncludes("deploy/synology/common-deploy.sh", "LOCK_OWNER_TOKEN");
assertIncludes("deploy/synology/common-deploy.sh", "terminate_active_child");
assertIncludes("deploy/synology/common-deploy.sh", "verify_no_deploy_processes");
assertIncludes("deploy/synology/common-deploy.sh", 'die "setsid executable is required');
assertIncludes("deploy/synology/deploy.sh", 'exec "$TIMEOUT_BIN" -k 30 1200');
assertIncludes("deploy/synology/deploy.sh", "WIREGENE_DEPLOY_WRAPPED=1");

for (const relativePath of [
  "deploy/synology/common-deploy.sh",
  "deploy/synology/deploy.sh",
]) {
  assertExcludes(relativePath, /docker\s+system\s+prune/i);
  assertExcludes(relativePath, /docker\s+volume\s+prune/i);
  assertExcludes(relativePath, /\b(?:system|volume|container|image)\s+prune\b/i);
  assertExcludes(relativePath, /compose\s+down(?:\s|$)/i);
  assertExcludes(relativePath, /compose[^\n]*(?:\srm\s|\srm$)/i);
  assertExcludes(relativePath, /(?:docker|DOCKER_BIN)[^\n]*(?:\srm\s|container\s+rm)/i);
  assertExcludes(relativePath, /logs\s+(?:-f|--follow)/i);
  assertExcludes(relativePath, /tail\s+-f/i);
  assertExcludes(relativePath, /npm\s+(?:install|run\s+(?:build|start|dev))/i);
}

assertIncludes(".github/workflows/publish-container.yml", "packages: write");
assertIncludes(".github/workflows/publish-container.yml", "platforms: linux/amd64");
assertIncludes(".github/workflows/publish-container.yml", "docker/build-push-action@v6");
assertIncludes(".github/workflows/publish-container.yml", '${{ github.ref }}');
assertIncludes(".github/workflows/publish-container.yml", "push: false");
assertIncludes(".github/workflows/publish-container.yml", "load: true");
assertIncludes(".github/workflows/publish-container.yml", "Publish verified image tags");
assertIncludes(".github/workflows/publish-container.yml", "{{.State.ExitCode}}");
assertIncludes("server.mjs", 'url.pathname === "/api/ready"');
assertIncludes("server.mjs", "await checkRepositoryReadiness(repository, readinessState)");
assertIncludes("server.mjs", "now - readinessState.lastSuccessAt < 30_000");
assertIncludes("server.mjs", "now - readinessState.lastFailureAt < 5_000");
assertIncludes("google-drive-rest.mjs", "findExistingDatabaseFileId(signal)");
assertIncludes(
  "deploy/synology/site.env.example",
  "sha-REPLACE_WITH_FULL_COMMIT_SHA",
);

const allowedSiteKeys = new Set([
  "APP_NAME",
  "APP_DIR",
  "APP_IMAGE",
  "APP_PORT",
  "HEALTH_URL",
  "APP_ENV_FILE",
  "REQUIRED_ENV_VARS",
]);

for (const line of files["deploy/synology/site.env.example"].split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    continue;
  }

  const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=/);
  if (!match || !allowedSiteKeys.has(match[1])) {
    throw new Error(`site.env.example crosses the site-variable boundary: ${trimmed}`);
  }
}

console.log("Synology deployment contract checks passed.");
