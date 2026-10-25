/**
 * install-hooks.mjs — points git at .githooks/ (tracked hooks) and makes the
 * hook files executable. Idempotent; run via the `prepare` script on npm
 * install, or by hand: `node scripts/install-hooks.mjs`.
 *
 * core.hooksPath is set to the absolute path so it resolves correctly no
 * matter where git is invoked from. `prepare` re-runs on every install, so a
 * moved repo self-heals.
 */
import { execSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const hooksDir = join(root, ".githooks");

try {
  execSync(`git config core.hooksPath "${hooksDir}"`, { cwd: root, stdio: "pipe" });
} catch {
  console.log("install-hooks: not a git repo, skipping");
  process.exit(0);
}

for (const file of readdirSync(hooksDir)) {
  if (file.endsWith(".sample")) continue;
  const path = join(hooksDir, file);
  if (existsSync(path)) {
    try {
      chmodSync(path, 0o755);
    } catch {
      /* non-fatal */
    }
  }
}

console.log(`install-hooks: core.hooksPath → ${hooksDir}`);
