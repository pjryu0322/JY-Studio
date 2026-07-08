export type StructureQualityGateSnapshot = {
  structureCoverageStatus: string | null;
  knowledgeQualityStatus: string | null;
};

/** Submit/approve: reports must exist and neither may be FAIL. */
export function meetsStructureQualityGate(snapshot: StructureQualityGateSnapshot): boolean {
  if (!snapshot.structureCoverageStatus || !snapshot.knowledgeQualityStatus) {
    return false;
  }
  return (
    snapshot.structureCoverageStatus !== "FAIL" && snapshot.knowledgeQualityStatus !== "FAIL"
  );
}

export function getStructureQualityBlockingMessage(
  snapshot: StructureQualityGateSnapshot,
): string | null {
  if (!snapshot.structureCoverageStatus || !snapshot.knowledgeQualityStatus) {
    return "구조/품질 점검을 먼저 실행해 주세요.";
  }
  if (snapshot.structureCoverageStatus === "FAIL") {
    return "구조 커버리지(FAIL) 결과로 제출·승인할 수 없습니다. 필수 섹션을 보완한 뒤 재평가하세요.";
  }
  if (snapshot.knowledgeQualityStatus === "FAIL") {
    return "지식 품질(FAIL) 결과로 제출·승인할 수 없습니다. 이슈를 해결한 뒤 재평가하세요.";
  }
  return null;
}

export function hasStructureQualityWarning(snapshot: StructureQualityGateSnapshot): boolean {
  return (
    snapshot.structureCoverageStatus === "WARNING" ||
    snapshot.knowledgeQualityStatus === "WARNING"
  );
}
