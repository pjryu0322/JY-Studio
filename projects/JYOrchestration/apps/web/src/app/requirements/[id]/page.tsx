"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { FeatureSummaryPanel } from "@/components/workflow/FeatureSummaryPanel";
import { MeetingMinutesPanel } from "@/components/workflow/MeetingMinutesPanel";
import {
  getMockFeaturesForSession,
  getMockMinutesForSession,
  getMockRequirement,
  getMockSessionsForRequirement,
} from "@/lib/mock/workflowMock";

type TabId = "overview" | "sessions" | "minutes" | "features" | "tasks";

export default function RequirementDetailPage() {
  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "sessions" as const, label: "Sessions" },
        { id: "minutes" as const, label: "Minutes" },
        { id: "features" as const, label: "Features" },
        { id: "tasks" as const, label: "Tasks" },
      ] satisfies { id: TabId; label: string }[],
    []
  );

  const params = useParams<{ id: string }>();
  const requirementId = typeof params?.id === "string" ? params.id : "";
  const req = getMockRequirement(requirementId);
  const sessions = getMockSessionsForRequirement(requirementId);

  const search = useSearchParams();
  const router = useRouter();
  const tabRaw = (search?.get("tab") ?? "overview").toLowerCase();
  const tab = (tabs.some((t) => t.id === tabRaw) ? tabRaw : "overview") as TabId;

  const setTab = (next: TabId) => {
    router.replace(`/requirements/${encodeURIComponent(requirementId)}?tab=${encodeURIComponent(next)}`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{req?.title ?? "Requirement"}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            {req?.description ?? "Unknown requirement id."}
          </div>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <Link href="/requirements" style={{ fontSize: 13, textDecoration: "underline" }}>
            Back to list
          </Link>
        </div>
      </div>

      <nav aria-label="Requirement tabs" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: tab === t.id ? "1px solid #2563eb" : "1px solid #d1d5db",
              background: tab === t.id ? "#eff6ff" : "#fafafa",
              color: tab === t.id ? "#1e40af" : "#111827",
              fontWeight: tab === t.id ? 700 : 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Overview</div>
          <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.6 }}>
            This is a UI skeleton. Next phase will bind real requirement data, sessions, minutes generation, and feature derivation.
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 13, color: "#6b7280" }}>
            <div>
              <strong style={{ color: "#111827" }}>{req?.sessionCount ?? sessions.length}</strong> sessions
            </div>
            <div>
              <strong style={{ color: "#111827" }}>{req?.featureCount ?? 0}</strong> features
            </div>
          </div>
        </div>
      ) : null}

      {tab === "sessions" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Sessions</div>
          {sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>(no sessions)</div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {s.createdAt} · {s.status}
                    </div>
                  </div>
                  <Link
                    href={`/collaboration/${encodeURIComponent(s.id)}`}
                    style={{ fontSize: 13, textDecoration: "underline", alignSelf: "center" }}
                  >
                    Open workspace
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "minutes" ? (
        <MeetingMinutesPanel minutes={getMockMinutesForSession(sessions[0]?.id ?? "sess-201")} />
      ) : null}

      {tab === "features" ? (
        <FeatureSummaryPanel features={getMockFeaturesForSession(sessions[0]?.id ?? "sess-201")} />
      ) : null}

      {tab === "tasks" ? (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Tasks</div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
            (placeholder) Tasks will be derived from Features in a later phase.
          </div>
        </div>
      ) : null}
    </div>
  );
}

