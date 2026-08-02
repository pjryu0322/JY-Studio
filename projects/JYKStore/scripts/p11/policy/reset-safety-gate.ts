import { CONFIRM_TOKEN } from "./reset-allowlist.ts";
import type { ParsedArgs } from "../types.ts";

export function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[2] ?? "inventory";
  const execute = argv.includes("--execute");
  const confirmIdx = argv.indexOf("--confirm");
  const confirm = confirmIdx >= 0 ? (argv[confirmIdx + 1] ?? "") : "";
  return { command, execute, confirm };
}

/**
 * Refuse execute unless both --execute and --confirm JYKSTORE_CLEAN_RESET are present.
 * Returns false when the caller should stop (exitCode already set to 2).
 */
export function assertExecuteAllowed(args: ParsedArgs): boolean {
  if (args.command !== "execute") return true;
  if (!args.execute || args.confirm !== CONFIRM_TOKEN) {
    console.error(
      "Refusing execute. Required: --execute --confirm JYKSTORE_CLEAN_RESET",
    );
    process.exitCode = 2;
    return false;
  }
  return true;
}
