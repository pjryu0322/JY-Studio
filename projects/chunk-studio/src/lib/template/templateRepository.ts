import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TemplateListItem, TemplateSchema } from "./schema";
import { templateListItemSchema, templateSchema } from "./schema";

const baseDir = path.join(process.cwd(), "data", "templates");

function familyDir(family: string): string {
  return path.join(baseDir, family);
}

function templatePath(family: string, templateId: string, version: string): string {
  return path.join(familyDir(family), templateId, version, "template.json");
}

function legacySchemaPath(family: string, templateId: string, version: string): string {
  return path.join(familyDir(family), templateId, version, "schema.json");
}

function indexPath(family: string): string {
  return path.join(familyDir(family), "index.json");
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function listTemplates(family: string): Promise<TemplateListItem[]> {
  const index = await safeReadJson<Array<Partial<TemplateListItem>>>(indexPath(family));
  if (!index) return [];
  const now = new Date().toISOString();
  return index
    .map((item) =>
      templateListItemSchema.safeParse({
        ...item,
        updatedAt: item.updatedAt ?? now,
      })
    )
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data);
}

export async function getTemplate(
  family: string,
  templateId: string,
  version?: string
): Promise<TemplateSchema | null> {
  let resolvedVersion = version;
  if (!resolvedVersion) {
    const list = await listTemplates(family);
    resolvedVersion =
      list.find((item) => item.templateId === templateId)?.latestVersion ?? "";
  }
  if (!resolvedVersion) return null;
  const raw =
    (await safeReadJson<TemplateSchema>(
      templatePath(family, templateId, resolvedVersion)
    )) ??
    (await safeReadJson<TemplateSchema>(
      legacySchemaPath(family, templateId, resolvedVersion)
    ));
  if (!raw) return null;
  const parsed = templateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function bumpMinorVersion(version: string): string {
  const match = /^v(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return "v0.1";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return "v0.1";
  return `v${major}.${minor + 1}`;
}

export async function saveTemplate(schema: TemplateSchema): Promise<TemplateSchema> {
  const parsed = templateSchema.parse(schema);
  const list = await listTemplates(parsed.family);
  const found = list.find((item) => item.templateId === parsed.templateId);
  const resolvedVersion = found ? bumpMinorVersion(found.latestVersion) : "v0.1";
  const now = new Date().toISOString();
  const resolvedSchema: TemplateSchema = {
    ...parsed,
    version: resolvedVersion,
    updatedAt: now,
    createdAt: parsed.createdAt || now,
  };

  const filePath = templatePath(
    resolvedSchema.family,
    resolvedSchema.templateId,
    resolvedSchema.version
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(resolvedSchema, null, 2), "utf-8");

  const next: TemplateListItem[] = [...list];
  const existing = next.find((item) => item.templateId === resolvedSchema.templateId);
  if (existing) {
    existing.name = resolvedSchema.name;
    existing.docType = resolvedSchema.docType;
    existing.latestVersion = resolvedSchema.version;
    existing.updatedAt = resolvedSchema.updatedAt;
  } else {
    next.push({
      templateId: resolvedSchema.templateId,
      name: resolvedSchema.name,
      docType: resolvedSchema.docType,
      latestVersion: resolvedSchema.version,
      updatedAt: resolvedSchema.updatedAt,
    });
  }

  await mkdir(familyDir(resolvedSchema.family), { recursive: true });
  await writeFile(
    indexPath(resolvedSchema.family),
    JSON.stringify(next, null, 2),
    "utf-8"
  );
  return resolvedSchema;
}

export async function getLatestTemplates(
  family: string,
  docType?: TemplateSchema["docType"]
): Promise<TemplateSchema[]> {
  const list = await listTemplates(family);
  const filtered = docType
    ? list.filter((item) => item.docType === docType || item.docType === "unknown")
    : list;
  const results = await Promise.all(
    filtered.map((item) =>
      getTemplate(family, item.templateId, item.latestVersion)
    )
  );
  return results.filter((v): v is TemplateSchema => Boolean(v));
}

