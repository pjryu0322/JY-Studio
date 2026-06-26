import type { ProjectGraphActivityFeedRow } from "@/lib/project-graph/projectGraphActivityClient";

const NODE_TYPE_LABELS: Record<string, string> = {
  Idea: "프로젝트 아이디어",
  Problem: "해결 문제",
  Requirement: "요구사항",
  Feature: "주요 기능",
  Actor: "사용자 역할",
  Flow: "서비스 흐름",
  GraphEdge: "항목 간 연결",
};

function countPhrase(nodeType: string, count: number): string {
  const label = NODE_TYPE_LABELS[nodeType] ?? nodeType;
  if (nodeType === "GraphEdge") return `연결 ${count}개가 정리되었습니다.`;
  return `${label} ${count}개가 정리되었습니다.`;
}

/** Maps internal activity feed lines to user-facing Korean copy (UX only). */
export function toUserFriendlyGraphActivityLine(row: ProjectGraphActivityFeedRow): string {
  const line = row.line.trim();
  const view = row.detail.view;

  if (view === "planning_snapshot") {
    return "프로젝트 아이디어가 구조화되었습니다.";
  }

  if (view === "group_summary" && row.detail.groupSummary) {
    const g = row.detail.groupSummary;
    return countPhrase(g.nodeType, g.count);
  }

  if (line.includes("Planning Snapshot")) return "프로젝트 아이디어가 구조화되었습니다.";
  if (line.includes("AI 기획자 추천안")) return "AI 기획 추천안이 반영되었습니다.";
  if (line.includes("원본 대화 저장")) return "대화 내용이 저장되었습니다.";
  if (line.startsWith("Graph Edge") && line.includes("생성")) return "그래프가 업데이트되었습니다.";
  if (line.includes("후보") && line.includes("생성")) {
    const m = line.match(/^(\w+)\s+후보\s+(\d+)개/);
    if (m) return countPhrase(m[1]!, Number(m[2]));
  }
  if (line.startsWith("Candidate:")) return "구조 후보가 정리되었습니다.";
  if (line.includes("기획") && line.includes("초기화")) return "기획 초기화 이후 새 구조가 생성되었습니다.";
  if (line.includes("Graph") && line.includes("반영")) return "그래프가 업데이트되었습니다.";

  if (row.detail.title && !line.startsWith("Candidate:")) {
    return `${row.detail.title} 내용이 반영되었습니다.`;
  }

  return line.replace(/^Event:\s*/, "").replace(/^Candidate:\s*/, "구조 후보: ");
}
