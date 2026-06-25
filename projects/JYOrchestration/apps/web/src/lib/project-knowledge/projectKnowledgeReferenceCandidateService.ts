export {
  buildProjectReferenceAssessment,
  getProjectReferenceEligibility,
  type LiveGraphReferenceSummary,
  type ProjectReferenceAssessment,
  type ReferenceAssessmentSource,
} from "@/lib/project-knowledge/projectKnowledgeReferenceAssessmentService";
import { buildProjectReferenceAssessment } from "@/lib/project-knowledge/projectKnowledgeReferenceAssessmentService";
import { ensureProjectReferenceMetadataReady } from "@/lib/project-knowledge/projectKnowledgeReferenceEnsureService";
import { emptyReferencePackageReusableAssets } from "@/lib/project-knowledge/projectKnowledgeReferenceSnapshotAssets";
import type { ReferencePackageCandidate } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";

export async function buildReferencePackageCandidate(projectId: string): Promise<ReferencePackageCandidate> {
  const pid = String(projectId ?? "").trim();
  await ensureProjectReferenceMetadataReady(pid);

  const assessment = await buildProjectReferenceAssessment(pid);
  const { eligibility, latestReferenceRevision, exclusions, snapshotReusableAssets } = assessment;

  const readiness =
    eligibility.level === "VERIFIED"
      ? "VERIFIED"
      : eligibility.level === "SNAPSHOT_READY"
        ? "READY"
        : eligibility.level === "PARTIAL"
          ? "PARTIAL"
          : "NOT_READY";

  const hasSnapshotAssets =
    latestReferenceRevision &&
    snapshotReusableAssets &&
    (eligibility.level === "SNAPSHOT_READY" || eligibility.level === "VERIFIED");

  const reusableAssets: ReferencePackageCandidate["reusableAssets"] = hasSnapshotAssets
    ? snapshotReusableAssets
    : emptyReferencePackageReusableAssets("참조 저장본 생성 후 패키지 후보를 만들 수 있습니다.");

  return {
    projectId: assessment.projectId,
    ...(latestReferenceRevision ? { sourceRevisionId: latestReferenceRevision.id } : {}),
    readiness,
    summary:
      readiness === "READY" || readiness === "VERIFIED"
        ? "승인된 참조 저장본을 기준으로 패키지 후보를 정리했습니다."
        : "참조 패키지 후보로 사용하기에 구조가 아직 부족합니다.",
    reusableAssets,
    exclusions,
    blockingIssues: [...eligibility.blockingIssues],
  };
}
