/**
 * Cursor CLI용 페이로드 임시 파일 저장 (경로·토큰 하드코딩 없음).
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { CursorExecutionPayload } from "@/lib/integration/cursorExecutionTypes";
import { serializeCursorExecutionPayload } from "@/lib/integration/cursorExecutionTypes";

export type WriteCursorPayloadResult = { absolutePath: string };

/**
 * JSON 페이로드를 디스크에 기록한다.
 * - CURSOR_PAYLOAD_DIR 이 있으면 그 경로
 * - 없으면 CURSOR_WORKDIR/.jy-orchestration/cursor-payloads
 * - 둘 다 없으면 process.cwd()/.jy-orchestration/cursor-payloads
 */
export async function writeCursorPayloadToFile(
  payload: CursorExecutionPayload
): Promise<WriteCursorPayloadResult> {
  const workdir = process.env.CURSOR_WORKDIR?.trim();
  const explicitDir = process.env.CURSOR_PAYLOAD_DIR?.trim();
  const baseDir =
    explicitDir ||
    path.join(workdir || process.cwd(), ".jy-orchestration", "cursor-payloads");

  try {
    await mkdir(baseDir, { recursive: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Cursor 페이로드 디렉터리 생성 실패 (${baseDir}): ${msg}`);
  }

  const ts = Date.now();
  const safeTask = payload.taskId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  const fileName = `${ts}-${safeTask}.json`;
  const absolutePath = path.join(baseDir, fileName);
  const body = serializeCursorExecutionPayload(payload);

  try {
    await writeFile(absolutePath, body, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Cursor 페이로드 파일 쓰기 실패 (${absolutePath}): ${msg}`);
  }

  return { absolutePath };
}
