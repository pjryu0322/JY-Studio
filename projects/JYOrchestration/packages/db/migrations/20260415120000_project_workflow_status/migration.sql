-- 워크플로: 신규 프로젝트는 REQUIREMENTS_PENDING 후 실행 계획(프로젝트 상세) 진입
ALTER TABLE "projects" ADD COLUMN "workflowStatus" TEXT;
