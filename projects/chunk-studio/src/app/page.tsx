import EntryCard from "@/components/entry/EntryCard";
import RecentJobsPanel from "@/components/entry/RecentJobsPanel";
import RecentDocumentsPanel from "@/components/entry/RecentDocumentsPanel";
import SystemAlertsPanel from "@/components/entry/SystemAlertsPanel";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: 20 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ border: "1px solid #ddd", borderRadius: 12, background: "#fff", padding: 16 }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>Chunk Studio</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.5 }}>
            Visual chunking workbench for trustworthy document structure inspection, semantic chunk review,
            and RAG-ready export preparation.
          </p>
        </header>

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <EntryCard
            title="Operator"
            subtitle="Worker + Reviewer"
            description="Upload documents, run chunking jobs, inspect structure/preview/chunks, review diffs, and export RAG chunks."
            href="/workspace"
          />
          <EntryCard
            title="Manager"
            subtitle="Template Manager + System Admin"
            description="Monitor job pipeline and failures, manage templates, review recommendations/drift, and inspect system alerts."
            href="/admin"
          />
        </section>

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <RecentJobsPanel />
          <RecentDocumentsPanel />
          <SystemAlertsPanel />
        </section>
      </div>
    </main>
  );
}
