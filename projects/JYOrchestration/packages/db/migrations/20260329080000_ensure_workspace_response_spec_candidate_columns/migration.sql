-- Spec 후보 점수/메타(JSON). 일부 환경에서 20260328204500 적용 전 DB가 남아 GET spec-workspace 시 P2022가 날 수 있음.
ALTER TABLE "project_spec_workspace_responses" ADD COLUMN IF NOT EXISTS "specCandidateScore" JSONB;
ALTER TABLE "project_spec_workspace_responses" ADD COLUMN IF NOT EXISTS "specCandidateMeta" JSONB;
