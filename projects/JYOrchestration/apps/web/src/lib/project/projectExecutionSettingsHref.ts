/** 프로젝트 실행 환경(연결·정책·검증) 설정 화면 URL */
export function projectExecutionSettingsHref(
  projectId: string,
  opts?: Readonly<{ from?: "planning"; envNote?: string | null }>
): string {
  const pid = String(projectId ?? "").trim();
  const q = new URLSearchParams();
  if (pid) q.set("projectId", pid);
  if (opts?.from) q.set("from", opts.from);
  const note = opts?.envNote != null ? String(opts.envNote).trim() : "";
  if (note) q.set("envNote", note);
  const qs = q.toString();
  return qs ? `/project-admin/settings?${qs}` : "/project-admin/settings";
}
