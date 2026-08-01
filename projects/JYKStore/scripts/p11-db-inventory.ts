/** Thin wrapper — see scripts/p11-clean-reset.ts */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", join(root, "scripts/p11-clean-reset.ts"), "inventory", ...process.argv.slice(2)],
  { stdio: "inherit", cwd: root },
);
process.exit(result.status ?? 1);
