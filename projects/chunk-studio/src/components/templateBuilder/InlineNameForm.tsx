"use client";

import InlineFormContainer from "./InlineFormContainer";

interface InlineNameFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  margin?: string;
}

export default function InlineNameForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = "이름 입력",
  submitLabel = "저장",
  autoFocus = true,
  margin = "2px 0 6px",
}: InlineNameFormProps) {
  return (
    <InlineFormContainer
      margin={margin}
      submitLabel={submitLabel}
      onSubmit={onSubmit}
      onCancel={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit();
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
    >
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, fontSize: 12, padding: "4px 6px" }}
      />
    </InlineFormContainer>
  );
}
