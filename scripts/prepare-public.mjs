import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const staticFiles = [
  "index.html",
  "admin.html",
  "clinician.html",
  "sensor.html",
  "app.mjs",
  "admin.mjs",
  "clinician.mjs",
  "sensor.mjs",
  "models.mjs",
  "storage.mjs",
  "auth.mjs",
  "record-utils.mjs",
  "runtime-config.js",
  "styles.css",
];

await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });

for (const file of staticFiles) {
  await copyFile(path.join(rootDir, file), path.join(publicDir, file));
}

console.log(`Prepared ${staticFiles.length} static files in public/`);
