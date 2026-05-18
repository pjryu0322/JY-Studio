import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

export const USER_AVATAR_PUBLIC_PREFIX = "/user-avatars";

const MAX_BYTES = 2 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function avatarDirAbs(): string {
  return path.join(process.cwd(), "public", "user-avatars");
}

export function userAvatarPublicPath(userId: string, ext: string): string {
  return `${USER_AVATAR_PUBLIC_PREFIX}/${userId}.${ext}`;
}

/** `avatarUrl`이 본인 `userId` 소유 경로일 때만 디스크에서 삭제 */
export async function deleteUserAvatarFileIfOwned(userId: string, avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl) return;
  const u = String(avatarUrl).trim();
  if (!u.startsWith(`${USER_AVATAR_PUBLIC_PREFIX}/`)) return;
  if (u.includes("..")) return;
  const base = path.basename(u);
  if (!base.startsWith(`${userId}.`)) return;
  const allowed = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const ext = base.split(".").pop()?.toLowerCase();
  if (!ext || !allowed.has(ext)) return;
  const fp = path.join(avatarDirAbs(), base);
  try {
    await unlink(fp);
  } catch {
    /* ignore */
  }
}

export async function writeUserAvatarFromUpload(
  userId: string,
  file: File
): Promise<{ publicPath: string; ext: string } | { error: string }> {
  if (file.size > MAX_BYTES) {
    return { error: "이미지는 2MB 이하여야 합니다." };
  }
  const mime = String(file.type ?? "").trim().toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) {
    return { error: "JPEG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return { error: "이미지는 2MB 이하여야 합니다." };
  }

  const dir = avatarDirAbs();
  await mkdir(dir, { recursive: true });

  const filename = `${userId}.${ext}`;
  const fp = path.join(dir, filename);
  await writeFile(fp, buf);

  return { publicPath: userAvatarPublicPath(userId, ext), ext };
}
