import { cmdBackup } from "./commands/backup.ts";
import { cmdDryRun } from "./commands/dry-run.ts";
import { cmdExecute } from "./commands/execute.ts";
import { cmdInventory } from "./commands/inventory.ts";
import { cmdVerify } from "./commands/verify.ts";
import { prisma } from "./db/client.ts";
import {
  assertExecuteAllowed,
  parseArgs,
} from "./policy/reset-safety-gate.ts";

export async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!assertExecuteAllowed(args)) return;

  switch (args.command) {
    case "inventory":
      await cmdInventory();
      break;
    case "dry-run":
      await cmdDryRun();
      break;
    case "backup":
      await cmdBackup();
      break;
    case "execute":
      await cmdExecute();
      break;
    case "verify":
      await cmdVerify();
      break;
    default:
      console.error(`Unknown command: ${args.command}`);
      process.exitCode = 2;
  }
}

export async function runCli(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
