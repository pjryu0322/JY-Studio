/**
 * P11 unified Clean Reset CLI.
 *
 * Default is read-only. Destructive modes require both:
 *   --execute --confirm JYKSTORE_CLEAN_RESET
 *
 * Usage:
 *   node --import tsx scripts/p11-clean-reset.ts inventory
 *   node --import tsx scripts/p11-clean-reset.ts dry-run
 *   node --import tsx scripts/p11-clean-reset.ts backup
 *   node --import tsx scripts/p11-clean-reset.ts execute --execute --confirm JYKSTORE_CLEAN_RESET
 *   node --import tsx scripts/p11-clean-reset.ts verify
 *
 * Implementation lives under scripts/p11/ (policy, db, storage, commands).
 */
export {
  CONFIRM_TOKEN,
  KEEP_EMAILS,
  P11_CANONICAL_ACCOUNTS,
} from "./p11/policy/reset-allowlist.ts";

import { runCli } from "./p11/cli.ts";

void runCli();
