/**
 * 운영 안전 모드: 실제 Git 워크스페이스 반영 등 위험 동작을 서버에서 차단.
 * `JY_SAFE_MODE=true` 또는 `JY_SAFE_MODE=1` 이면 활성.
 */
export function isExecutionSafeMode(): boolean {
  const v = String(process.env.JY_SAFE_MODE ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
