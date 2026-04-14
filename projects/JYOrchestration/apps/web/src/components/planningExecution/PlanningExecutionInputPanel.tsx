"use client";

/**
 * Planning input shell — value is controlled by parent (live route or demo). No bundle fields.
 */

export function PlanningExecutionInputPanel({
  projectId,
  inputText,
  onInputTextChange,
  disabled,
}: {
  readonly projectId: string;
  readonly inputText: string;
  readonly onInputTextChange: (v: string) => void;
  readonly disabled?: boolean;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label="Planning input">
      <h3 className="text-sm font-semibold text-neutral-800">입력</h3>
      <p className="mt-1 text-xs text-neutral-500">
        프로젝트 <span className="font-mono">{projectId}</span>
      </p>
      <label className="mt-3 block text-xs font-medium text-neutral-600" htmlFor="planning-input-text">
        무엇을 만들고 싶은지
      </label>
      <p className="mt-1 text-xs text-neutral-500">
        한 문단으로 목적/대상 사용자/핵심 기능을 적어주세요. 이후 상태에 따라 “상태 재평가(준비만)” 또는 “실행 시작(준비+시작)”을 선택합니다.
      </p>
      <textarea
        id="planning-input-text"
        className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm text-neutral-900"
        rows={4}
        value={inputText}
        disabled={disabled}
        onChange={(e) => onInputTextChange(e.target.value)}
        placeholder="예) 사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다…"
      />
    </section>
  );
}
