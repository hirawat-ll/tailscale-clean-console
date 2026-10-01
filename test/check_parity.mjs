#!/usr/bin/env node
/* chrome/ and firefox/ ship the same script and stylesheet; keep them byte
   identical so a fix in one build always reaches the other. Run in CI. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["content.js", "styles.css"];
const problems = [];

for (const file of files) {
  const chrome = readFileSync(join(ROOT, "chrome", file));
  const firefox = readFileSync(join(ROOT, "firefox", file));
  if (!chrome.equals(firefox)) problems.push(`chrome/${file} and firefox/${file} differ`);
}

if (problems.length) {
  console.error("Extension parity check failed:");
  for (const problem of problems) console.error("  - " + problem);
  console.error("\nCopy the shared file across both builds.");
  process.exit(1);
}
console.log(`parity check ok - ${files.join(" and ")} are identical`);
