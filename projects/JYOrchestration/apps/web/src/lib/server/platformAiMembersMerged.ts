import {
  getPlatformAiMemberById,
  listPlatformAiMembers,
  mergePlatformAiMember,
  type PlatformAiMember,
} from "@/lib/ai/platformAiMembers";
import { readOverrides } from "@/lib/server/platformAiMemberOverridesStore";

export async function listMergedPlatformAiMembers(): Promise<PlatformAiMember[]> {
  const { overrides } = await readOverrides();
  return listPlatformAiMembers().map((d) => mergePlatformAiMember(d, overrides[d.id] ?? {}));
}

export async function getMergedPlatformAiMemberById(id: string): Promise<PlatformAiMember | null> {
  const base = getPlatformAiMemberById(id);
  if (!base) return null;
  const { overrides } = await readOverrides();
  return mergePlatformAiMember(base, overrides[id] ?? {});
}
