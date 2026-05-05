import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PlatformAiMember } from "@/lib/ai/platformAiMembers";

type OverridesFile = {
  readonly overrides: Record<string, Partial<PlatformAiMember>>;
};

const FILE_NAME = "platform-ai-members-overrides.json";

function storePath(): string {
  return path.join(process.cwd(), ".data", FILE_NAME);
}

async function ensureDir(): Promise<void> {
  const dir = path.join(process.cwd(), ".data");
  await mkdir(dir, { recursive: true });
}

export async function readOverrides(): Promise<OverridesFile> {
  try {
    const raw = await readFile(storePath(), "utf8");
    const j = JSON.parse(raw) as OverridesFile;
    if (!j || typeof j !== "object" || !j.overrides || typeof j.overrides !== "object") {
      return { overrides: {} };
    }
    return j;
  } catch {
    return { overrides: {} };
  }
}

export async function writeOverrides(next: OverridesFile): Promise<void> {
  await ensureDir();
  await writeFile(storePath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

/** 기본값 대비 차분만 저장한다. 빈 객체면 해당 id 오버라이드 제거 */
export async function upsertMemberDiffOverride(memberId: string, patch: Partial<PlatformAiMember>): Promise<void> {
  const cur = await readOverrides();
  if (!patch || Object.keys(patch).length === 0) {
    const rest = { ...cur.overrides };
    delete rest[memberId];
    await writeOverrides({ overrides: rest });
    return;
  }
  await writeOverrides({
    overrides: {
      ...cur.overrides,
      [memberId]: patch,
    },
  });
}
