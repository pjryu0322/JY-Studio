"use client";

interface AliasItem {
  from: string;
  to: string;
  count: number;
  enabled: boolean;
}

interface FeedbackSummaryProps {
  family: string;
  docType: string;
  labels: AliasItem[];
  sections: AliasItem[];
  loading: boolean;
  onRefresh: () => void;
  onToggle: (input: {
    type: "label" | "section";
    from: string;
    to: string;
    enabled: boolean;
  }) => void;
}

function AliasList({
  title,
  type,
  items,
  onToggle,
}: {
  title: string;
  type: "label" | "section";
  items: AliasItem[];
  onToggle: FeedbackSummaryProps["onToggle"];
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "#666" }}>데이터 없음</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {items.slice(0, 12).map((item) => (
            <div
              key={`${type}-${item.from}-${item.to}`}
              style={{
                border: "1px solid #eee",
                borderRadius: 6,
                padding: 8,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ flex: 1 }}>
                {item.from} -&gt; {item.to} ({item.count})
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) =>
                    onToggle({
                      type,
                      from: item.from,
                      to: item.to,
                      enabled: e.target.checked,
                    })
                  }
                />
                사용
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeedbackSummary({
  family,
  docType,
  labels,
  sections,
  loading,
  onRefresh,
  onToggle,
}: FeedbackSummaryProps) {
  return (
    <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 13, flex: 1 }}>Feedback</h4>
        <button type="button" onClick={onRefresh} disabled={loading} style={{ fontSize: 12, padding: "6px 8px" }}>
          {loading ? "로딩..." : "새로고침"}
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
        scope: family={family}, docType={docType}
      </div>
      <div style={{ fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Learned Aliases</div>
      <AliasList title="Label aliases" type="label" items={labels} onToggle={onToggle} />
      <AliasList title="Section aliases" type="section" items={sections} onToggle={onToggle} />
    </div>
  );
}
