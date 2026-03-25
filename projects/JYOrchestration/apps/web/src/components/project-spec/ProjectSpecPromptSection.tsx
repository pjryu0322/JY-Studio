type ProjectSpecPromptSectionProps = {
  prompt: string;
};

export function ProjectSpecPromptSection({ prompt }: ProjectSpecPromptSectionProps) {
  return (
    <section
      data-ui-label="[F-1-3] Function — GPT Prompt Guide"
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>GPT 프롬프트 가이드</h2>
      <p style={{ marginBottom: 10 }}>
        아래 프롬프트를 복사해서 GPT에 붙여넣으면, ProjectSpec 초안을 마크다운 구조로 빠르게 만들 수
        있습니다.
      </p>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#f7f7f7",
          border: "1px solid #e0e0e0",
          borderRadius: 8,
          padding: 14,
          fontSize: 14,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {prompt}
      </pre>
    </section>
  );
}
