import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const PACK_ID_MAX_LENGTH = 60;
export const PACK_ID_MIN_LENGTH = 3;
export const PACK_ID_PATTERN = /^[a-z0-9-]{3,60}$/;

export function slugifyPackName(name: string): string {
  let slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (slug.length > PACK_ID_MAX_LENGTH) {
    slug = slug.slice(0, PACK_ID_MAX_LENGTH).replace(/-$/, "");
  }

  return slug;
}

export function createPackIdFallback(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(2).toString("hex");
  return `pack-${y}${m}${day}-${suffix}`;
}

function isValidPackIdBase(id: string): boolean {
  return id.length >= PACK_ID_MIN_LENGTH && PACK_ID_PATTERN.test(id);
}

async function defaultPackIdExists(packId: string): Promise<boolean> {
  const row = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true },
  });
  return Boolean(row);
}

export async function generateUniquePackId(
  name: string,
  exists: (packId: string) => Promise<boolean> = defaultPackIdExists,
): Promise<string> {
  const base = slugifyPackName(name);

  if (!isValidPackIdBase(base)) {
    let candidate = createPackIdFallback();
    while (await exists(candidate)) {
      candidate = createPackIdFallback();
    }
    return candidate;
  }

  let candidate = base;
  let suffix = 2;
  const maxAttempts = 48;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!(await exists(candidate))) {
      return candidate;
    }

    const suffixStr = `-${suffix}`;
    const trimmedBase = base.slice(0, Math.max(PACK_ID_MIN_LENGTH, PACK_ID_MAX_LENGTH - suffixStr.length));
    candidate = `${trimmedBase}${suffixStr}`;
    suffix += 1;

    if (suffix > 40) {
      break;
    }
  }

  let fallback = createPackIdFallback();
  while (await exists(fallback)) {
    fallback = createPackIdFallback();
  }
  return fallback;
}
