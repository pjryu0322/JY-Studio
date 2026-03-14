import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AuditCategory =
  | "job"
  | "page_classifier"
  | "chunk_engine"
  | "workspace_edit"
  | "export"
  | "system";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  action: string;
  jobId?: string | null;
  level?: "info" | "warn" | "error";
  detail?: Record<string, unknown>;
}

const AUDIT_DIR = path.join(process.cwd(), "storage", "admin");
const AUDIT_FILE = path.join(AUDIT_DIR, "audit-log.json");
const MAX_ENTRIES = 4000;

export async function appendAuditLog(
  entry: Omit<AuditLogEntry, "id" | "timestamp">
): Promise<void> {
  const all = await readAllAuditLogs();
  all.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  const sliced = all.slice(-MAX_ENTRIES);
  await mkdir(AUDIT_DIR, { recursive: true });
  await writeFile(AUDIT_FILE, JSON.stringify(sliced, null, 2), "utf-8");
}

export async function readAuditLogs(limit = 200): Promise<AuditLogEntry[]> {
  const parsed = await readAllAuditLogs();
  return parsed.slice(-limit).reverse();
}

async function readAllAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const raw = await readFile(AUDIT_FILE, "utf-8");
    const parsed = JSON.parse(raw) as AuditLogEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}
