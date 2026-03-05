import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const storageRoot = path.join(process.cwd(), "storage", "jobs");

export function getJobDir(jobId: string): string {
  return path.join(storageRoot, jobId);
}

export async function ensureJobDir(jobId: string): Promise<string> {
  const dir = getJobDir(jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function getOriginalPath(jobId: string, ext: string): string {
  return path.join(getJobDir(jobId), `original.${ext}`);
}

export function getReplacementPdfPath(jobId: string): string {
  return path.join(getJobDir(jobId), "replacement.pdf");
}

export async function saveWebFile(file: File, targetPath: string): Promise<void> {
  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, bytes);
}

