import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";

export const PREVIEW_CAPTURE_ACTIVE_SESSIONS_KEY = "previewCaptureActiveSessionsV1" as const;

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS_PER_PROJECT = 24;

export type PreviewCaptureActiveSessionV1 = Readonly<{
  readonly captureId: string;
  readonly projectId: string;
  readonly previewUrl: string;
  readonly width: number;
  readonly height: number;
  readonly createdAt: string;
}>;

export function parsePreviewCaptureActiveSessionsFromState(
  state: Record<string, unknown> | null | undefined,
): readonly PreviewCaptureActiveSessionV1[] {
  if (!state) return [];
  const raw = state[PREVIEW_CAPTURE_ACTIVE_SESSIONS_KEY];
  if (!Array.isArray(raw)) return [];
  const out: PreviewCaptureActiveSessionV1[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const captureId = String(o.captureId ?? "").trim();
    const projectId = String(o.projectId ?? "").trim();
    const previewUrl = String(o.previewUrl ?? "").trim();
    const width = Number(o.width);
    const height = Number(o.height);
    const createdAt = String(o.createdAt ?? "").trim();
    if (!captureId || !projectId || !previewUrl || !createdAt) continue;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) continue;
    out.push({
      captureId,
      projectId,
      previewUrl,
      width: Math.round(width),
      height: Math.round(height),
      createdAt,
    });
  }
  return out;
}

function pruneSessions(sessions: readonly PreviewCaptureActiveSessionV1[], now = Date.now()): PreviewCaptureActiveSessionV1[] {
  return sessions
    .filter((s) => {
      const t = Date.parse(s.createdAt);
      return Number.isFinite(t) && now - t <= SESSION_TTL_MS;
    })
    .slice(-MAX_SESSIONS_PER_PROJECT);
}

export async function registerPreviewCaptureActiveSession(session: PreviewCaptureActiveSessionV1): Promise<void> {
  const row = await prisma.project.findUnique({
    where: { id: session.projectId },
    select: { requirementsStateJson: true },
  });
  if (!row) return;

  const prior = parseRequirementsStateJson(row.requirementsStateJson) ?? {};
  const existing = pruneSessions(parsePreviewCaptureActiveSessionsFromState(prior as Record<string, unknown>));
  const withoutDup = existing.filter((s) => s.captureId !== session.captureId);
  const next = pruneSessions([...withoutDup, session]);

  const merged = mergeRequirementsStateJson(prior, {
    [PREVIEW_CAPTURE_ACTIVE_SESSIONS_KEY]: next,
    lastSavedAt: new Date().toISOString(),
  });

  await prisma.project.update({
    where: { id: session.projectId },
    data: { requirementsStateJson: merged as object },
  });
}

export function findPreviewCaptureActiveSession(
  sessions: readonly PreviewCaptureActiveSessionV1[],
  captureId: string,
): PreviewCaptureActiveSessionV1 | null {
  const id = captureId.trim();
  const now = Date.now();
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i]!;
    if (s.captureId !== id) continue;
    const t = Date.parse(s.createdAt);
    if (!Number.isFinite(t) || now - t > SESSION_TTL_MS) return null;
    return s;
  }
  return null;
}
