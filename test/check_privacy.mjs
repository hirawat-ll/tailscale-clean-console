#!/usr/bin/env node
/* Guard for ROADMAP "Keep PRIVACY.md in sync whenever a new field is stored":
   every key the extension persists must be named in PRIVACY.md. Run in CI. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

const content = read("chrome/content.js");
const privacy = read("PRIVACY.md");

const storeKey = (content.match(/STORE_KEY\s*=\s*["']([^"']+)["']/) || [])[1];
const defaults = (content.match(/DEFAULT_SETTINGS\s*=\s*Object\.freeze\(\{([^}]*)\}\)/) || [])[1] || "";
const fields = [...defaults.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((m) => m[1]);

const problems = [];
if (!storeKey) problems.push("could not find STORE_KEY in chrome/content.js");
if (storeKey && !privacy.includes(storeKey)) {
  problems.push(`PRIVACY.md does not mention the storage key "${storeKey}"`);
}
if (!fields.length) problems.push("could not find any fields in DEFAULT_SETTINGS");
for (const field of fields) {
  if (!new RegExp(`\\b${field}\\b`).test(privacy)) {
    problems.push(`PRIVACY.md does not mention the stored field "${field}"`);
  }
}

if (problems.length) {
  console.error("PRIVACY.md is out of sync with what the extension stores:");
  for (const problem of problems) console.error("  - " + problem);
  console.error('\nAdd the missing name(s) under "What it stores" in PRIVACY.md.');
  process.exit(1);
}
console.log(`privacy check ok - key ${storeKey}; fields: ${fields.join(", ")}`);
