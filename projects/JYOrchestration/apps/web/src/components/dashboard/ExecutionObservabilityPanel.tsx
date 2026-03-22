import type { CSSProperties } from "react";
import type { ProjectObservabilitySnapshot } from "@/lib/metrics/projectObservabilityTypes";

type ExecutionObservabilityPanelProps = {
  data: ProjectObservabilitySnapshot | null;
  loading: boolean;
  errorMessage: string | null;
};

const cardStyle: CSSProperties = {
  border: "1px solid #e0e0e0",
  borderRadius: 10,
  padding: 14,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

function pct(part: number, whole: number): number {
  if (whole <= 0) {
    return 0;
  }
  return Math.round((100 * part) / whole);
}

function StackedBar(props: {
  segments: { key: string; value: number; color: string; label: string }[];
  total: number;
}) {
  const { segments, total } = props;
  if (total <= 0) {
    return (
      <div style={{ fontSize: 12, color: "#9e9e9e", marginTop: 6 }}>데이터 없음</div>
    );
  }
  const positive = segments.filter((s) => s.value > 0);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: "#f5f5f5" }}>
        {positive.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.value}`}
            style={{
              flex: s.value,
              minWidth: 3,
              background: s.color,
            }}
          />
        ))}
      </div>
      <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, fontSize: 12, color: "#555", lineHeight: 1.6 }}>
        {segments.map((s) => (
          <li key={s.key}>
            <span style={{ color: s.color, fontWeight: 600 }}>■</span> {s.label}: {s.value} (
            {pct(s.value, total)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExecutionObservabilityPanel({
  data,
  loading,
  errorMessage,
}: ExecutionObservabilityPanelProps) {
  return (
    <section
      style={{
        marginTop: 20,
        marginBottom: 8,
        padding: 16,
        borderRadius: 12,
        border: "1px solid #cfd8dc",
        background: "linear-gradient(180deg, #fafbfc 0%, #eceff1 100%)",
      }}
    >
      <h2 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700, color: "#263238" }}>
        실행 관측 (Execution Observability)
      </h2>
      <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#546e7a", lineHeight: 1.55 }}>
        Task·Run·Git 반영·재시도를 프로젝트 단위로 집계합니다. 읽기 전용이며 파이프라인을 변경하지 않습니다.
      </p>

      {loading ? (
        <p style={{ margin: 0, color: "#607d8b", fontSize: 14 }}>집계를 불러오는 중...</p>
      ) : null}
      {errorMessage ? (
        <p style={{ margin: 0, color: "#c62828", fontSize: 14 }}>{errorMessage}</p>
      ) : null}

      {!loading && !errorMessage && data ? (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px 20px",
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #eceff1",
              fontSize: 13,
              color: "#455a64",
            }}
          >
            <span>
              <strong style={{ color: "#2e7d32" }}>Task 완료율</strong>{" "}
              {data.task.total > 0 ? `${pct(data.task.done, data.task.total)}%` : "—"}{" "}
              <span style={{ color: "#90a4ae", fontSize: 12 }}>(DONE / 전체)</span>
            </span>
            <span>
              <strong style={{ color: "#c62828" }}>Task 실패율</strong>{" "}
              {data.task.total > 0 ? `${pct(data.task.failed, data.task.total)}%` : "—"}{" "}
              <span style={{ color: "#90a4ae", fontSize: 12 }}>(최신 Run FAILED / 전체)</span>
            </span>
            <span>
              <strong style={{ color: "#2e7d32" }}>Git 성공률</strong>{" "}
              {data.git.total > 0 ? `${pct(data.git.done, data.git.total)}%` : "—"}{" "}
              <span style={{ color: "#90a4ae", fontSize: 12 }}>(apply DONE / 전체 요청)</span>
            </span>
            <span>
              <strong style={{ color: "#c62828" }}>Git 실패율</strong>{" "}
              {data.git.total > 0 ? `${pct(data.git.failed, data.git.total)}%` : "—"}{" "}
              <span style={{ color: "#90a4ae", fontSize: 12 }}>(apply FAILED / 전체 요청)</span>
            </span>
          </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#37474f" }}>Task</h3>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#263238" }}>{data.task.total}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78909c" }}>총 Task 수</p>
            <StackedBar
              total={data.task.total}
              segments={[
                { key: "todo", value: data.task.todo, color: "#90a4ae", label: "TODO·기타" },
                { key: "running", value: data.task.running, color: "#ff9800", label: "실행 중(Run PENDING)" },
                { key: "done", value: data.task.done, color: "#43a047", label: "완료(DB DONE)" },
                { key: "failed", value: data.task.failed, color: "#e53935", label: "실패(Run FAILED)" },
              ]}
            />
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#37474f" }}>TaskRun</h3>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#263238" }}>
              {data.taskRun.total}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78909c" }}>
              프로젝트 소속 전체 실행 이력 건수
            </p>
          </div>

          <div style={{ ...cardStyle, gridColumn: "span 2" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#37474f" }}>
              Git 반영 요청
            </h3>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#263238" }}>{data.git.total}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78909c" }}>applyStatus 기준 분포</p>
            <StackedBar
              total={data.git.total}
              segments={[
                { key: "req", value: data.git.requested, color: "#78909c", label: "대기(PENDING 등)" },
                { key: "app", value: data.git.applying, color: "#29b6f6", label: "반영 중(APPLYING)" },
                { key: "done", value: data.git.done, color: "#66bb6a", label: "완료(DONE)" },
                { key: "fail", value: data.git.failed, color: "#ef5350", label: "실패(FAILED)" },
              ]}
            />
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#37474f" }}>Retry</h3>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#6a1b9a" }}>
              {data.retry.total}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78909c" }}>
              재시도가 1회 이상 있는 Git 요청 건수
            </p>
          </div>
        </div>
        </>
      ) : null}
    </section>
  );
}
