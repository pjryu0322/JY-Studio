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
      <h3 className="text-sm font-semibold text-neutral-800">Input</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Project <span className="font-mono">{projectId}</span>
      </p>
      <label className="mt-3 block text-xs font-medium text-neutral-600" htmlFor="planning-input-text">
        Planning text
      </label>
      <textarea
        id="planning-input-text"
        className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm text-neutral-900"
        rows={4}
        value={inputText}
        disabled={disabled}
        onChange={(e) => onInputTextChange(e.target.value)}
        placeholder="Describe what you want to build…"
      />
    </section>
  );
}
