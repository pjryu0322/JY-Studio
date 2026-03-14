import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ExportPolicy {
  ragEnabled: boolean;
  graphEnabled: boolean;
  includeMetadata: boolean;
  allowedFormats: Array<"json" | "jsonl" | "csv">;
  lastUpdatedAt: string;
}

export interface SeedDatasetItem {
  id: string;
  name: string;
  description?: string;
  family: "guide_manual" | "public_rfp" | "policy_manual" | "unknown_generic";
  createdAt: string;
}

const ADMIN_DIR = path.join(process.cwd(), "storage", "admin");
const EXPORT_POLICY_FILE = path.join(ADMIN_DIR, "export-policy.json");
const SEED_DATASETS_FILE = path.join(ADMIN_DIR, "seed-datasets.json");

const DEFAULT_POLICY: ExportPolicy = {
  ragEnabled: true,
  graphEnabled: true,
  includeMetadata: true,
  allowedFormats: ["jsonl", "json", "csv"],
  lastUpdatedAt: new Date(0).toISOString(),
};

export async function getExportPolicy(): Promise<ExportPolicy> {
  try {
    const raw = await readFile(EXPORT_POLICY_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ExportPolicy>;
    return {
      ragEnabled: parsed.ragEnabled ?? DEFAULT_POLICY.ragEnabled,
      graphEnabled: parsed.graphEnabled ?? DEFAULT_POLICY.graphEnabled,
      includeMetadata: parsed.includeMetadata ?? DEFAULT_POLICY.includeMetadata,
      allowedFormats:
        parsed.allowedFormats?.filter((fmt): fmt is "json" | "jsonl" | "csv" =>
          ["json", "jsonl", "csv"].includes(fmt)
        ) ?? DEFAULT_POLICY.allowedFormats,
      lastUpdatedAt: parsed.lastUpdatedAt ?? DEFAULT_POLICY.lastUpdatedAt,
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

export async function saveExportPolicy(policy: Omit<ExportPolicy, "lastUpdatedAt">): Promise<ExportPolicy> {
  const next: ExportPolicy = {
    ...policy,
    allowedFormats: policy.allowedFormats.filter((fmt): fmt is "json" | "jsonl" | "csv" =>
      ["json", "jsonl", "csv"].includes(fmt)
    ),
    lastUpdatedAt: new Date().toISOString(),
  };
  await mkdir(ADMIN_DIR, { recursive: true });
  await writeFile(EXPORT_POLICY_FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export async function getSeedDatasets(): Promise<SeedDatasetItem[]> {
  try {
    const raw = await readFile(SEED_DATASETS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as SeedDatasetItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addSeedDataset(
  input: Omit<SeedDatasetItem, "id" | "createdAt">
): Promise<SeedDatasetItem> {
  const all = await getSeedDatasets();
  const next: SeedDatasetItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  all.push(next);
  await mkdir(ADMIN_DIR, { recursive: true });
  await writeFile(SEED_DATASETS_FILE, JSON.stringify(all, null, 2), "utf-8");
  return next;
}

export async function removeSeedDataset(id: string): Promise<void> {
  const all = await getSeedDatasets();
  const filtered = all.filter((item) => item.id !== id);
  await mkdir(ADMIN_DIR, { recursive: true });
  await writeFile(SEED_DATASETS_FILE, JSON.stringify(filtered, null, 2), "utf-8");
}
