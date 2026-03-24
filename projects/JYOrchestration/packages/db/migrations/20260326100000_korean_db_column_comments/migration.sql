-- 한글 컬럼 설명(유지보수·가독성). Prisma /// 주석과 정책 정렬.

COMMENT ON TYPE "ProjectMemberRole" IS '프로젝트 멤버 역할(OWNER·PLANNER·REVIEWER·OPERATOR)';

-- users
COMMENT ON COLUMN "users"."id" IS '사용자 ID';
COMMENT ON COLUMN "users"."email" IS '이메일';
COMMENT ON COLUMN "users"."passwordHash" IS '비밀번호 해시';
COMMENT ON COLUMN "users"."name" IS '사용자 이름';
COMMENT ON COLUMN "users"."globalRole" IS '전역 권한';
COMMENT ON COLUMN "users"."createdAt" IS '생성일시';
COMMENT ON COLUMN "users"."updatedAt" IS '수정일시';

-- projects
COMMENT ON COLUMN "projects"."id" IS '프로젝트 ID';
COMMENT ON COLUMN "projects"."name" IS '프로젝트명';
COMMENT ON COLUMN "projects"."description" IS '프로젝트 설명';
COMMENT ON COLUMN "projects"."ownerUserId" IS '소유자 사용자 ID';
COMMENT ON COLUMN "projects"."projectType" IS '프로젝트 유형';
COMMENT ON COLUMN "projects"."repoUrl" IS '저장소 URL';
COMMENT ON COLUMN "projects"."defaultBranch" IS '기본 브랜치';
COMMENT ON COLUMN "projects"."status" IS '프로젝트 상태';
COMMENT ON COLUMN "projects"."gitApprovalMode" IS 'Git 승인 게이트 모드';
COMMENT ON COLUMN "projects"."gitPushMode" IS 'Git push 정책';
COMMENT ON COLUMN "projects"."autoCreateGitRequest" IS 'Task 실행 완료 시 Git 변경 요청 자동 생성 여부';
COMMENT ON COLUMN "projects"."createdAt" IS '생성일시';
COMMENT ON COLUMN "projects"."updatedAt" IS '수정일시';

-- execution_jobs
COMMENT ON COLUMN "execution_jobs"."id" IS '실행 작업 ID';
COMMENT ON COLUMN "execution_jobs"."projectId" IS '프로젝트 ID';
COMMENT ON COLUMN "execution_jobs"."type" IS '작업 유형(git-apply·pipeline·cursor)';
COMMENT ON COLUMN "execution_jobs"."status" IS '상태(PENDING·RUNNING·DONE·FAILED)';
COMMENT ON COLUMN "execution_jobs"."retryCount" IS '누적 실패 횟수';
COMMENT ON COLUMN "execution_jobs"."maxAttempts" IS '최대 시도 횟수';
COMMENT ON COLUMN "execution_jobs"."payload" IS '실행 페이로드(JSON)';
COMMENT ON COLUMN "execution_jobs"."result" IS '실행 결과(JSON)';
COMMENT ON COLUMN "execution_jobs"."lastError" IS '최근 실패 원인';
COMMENT ON COLUMN "execution_jobs"."availableAt" IS '재시도 가능 시각';
COMMENT ON COLUMN "execution_jobs"."claimedBy" IS '워커 클레임 식별자';
COMMENT ON COLUMN "execution_jobs"."heartbeatAt" IS '하트비트 시각';
COMMENT ON COLUMN "execution_jobs"."error" IS '최종 오류 요약';
COMMENT ON COLUMN "execution_jobs"."startedAt" IS '시작 시각';
COMMENT ON COLUMN "execution_jobs"."finishedAt" IS '종료 시각';
COMMENT ON COLUMN "execution_jobs"."createdAt" IS '생성일시';

-- execution_event_logs
COMMENT ON COLUMN "execution_event_logs"."id" IS '이벤트 로그 ID';
COMMENT ON COLUMN "execution_event_logs"."projectId" IS '프로젝트 ID';
COMMENT ON COLUMN "execution_event_logs"."executionJobId" IS '실행 작업 ID';
COMMENT ON COLUMN "execution_event_logs"."taskId" IS '태스크 ID';
COMMENT ON COLUMN "execution_event_logs"."gitChangeRequestId" IS 'Git 변경 요청 ID';
COMMENT ON COLUMN "execution_event_logs"."stage" IS '단계(PRECHECK·EXECUTE·APPLY·PR·RETRY·COMPLETE)';
COMMENT ON COLUMN "execution_event_logs"."status" IS '상태(STARTED·SUCCESS·FAILED)';
COMMENT ON COLUMN "execution_event_logs"."message" IS '메시지';
COMMENT ON COLUMN "execution_event_logs"."failureType" IS '실패 유형 분류';
COMMENT ON COLUMN "execution_event_logs"."detailJson" IS '상세 JSON';
COMMENT ON COLUMN "execution_event_logs"."durationMs" IS '소요 시간(ms)';
COMMENT ON COLUMN "execution_event_logs"."createdAt" IS '생성일시';

-- project_members
COMMENT ON COLUMN "project_members"."id" IS '멤버 행 ID';
COMMENT ON COLUMN "project_members"."projectId" IS '프로젝트 ID';
COMMENT ON COLUMN "project_members"."userId" IS '사용자 ID';
COMMENT ON COLUMN "project_members"."role" IS '프로젝트 내 역할';
COMMENT ON COLUMN "project_members"."createdAt" IS '생성일시';

-- project_spec_uploads
COMMENT ON COLUMN "project_spec_uploads"."id" IS '업로드 ID';
COMMENT ON COLUMN "project_spec_uploads"."projectId" IS '프로젝트 ID';
COMMENT ON COLUMN "project_spec_uploads"."sourceType" IS '소스 유형';
COMMENT ON COLUMN "project_spec_uploads"."originalFileName" IS '원본 파일명';
COMMENT ON COLUMN "project_spec_uploads"."fileType" IS '파일 MIME/유형';
COMMENT ON COLUMN "project_spec_uploads"."fileSize" IS '파일 크기(바이트)';
COMMENT ON COLUMN "project_spec_uploads"."contentText" IS '본문 텍스트';
COMMENT ON COLUMN "project_spec_uploads"."contentStored" IS '본문 저장 여부';
COMMENT ON COLUMN "project_spec_uploads"."status" IS '업로드 상태';
COMMENT ON COLUMN "project_spec_uploads"."parsedJson" IS '파싱 결과 JSON';
COMMENT ON COLUMN "project_spec_uploads"."parseStatus" IS '파싱 상태';
COMMENT ON COLUMN "project_spec_uploads"."parsedAt" IS '파싱 완료 시각';
COMMENT ON COLUMN "project_spec_uploads"."createdAt" IS '생성일시';
COMMENT ON COLUMN "project_spec_uploads"."updatedAt" IS '수정일시';

-- tasks
COMMENT ON COLUMN "tasks"."id" IS '태스크 ID';
COMMENT ON COLUMN "tasks"."projectId" IS '프로젝트 ID';
COMMENT ON COLUMN "tasks"."projectSpecUploadId" IS '스펙 업로드 ID';
COMMENT ON COLUMN "tasks"."name" IS '태스크명';
COMMENT ON COLUMN "tasks"."description" IS '설명';
COMMENT ON COLUMN "tasks"."status" IS '상태';
COMMENT ON COLUMN "tasks"."order" IS '정렬 순서';
COMMENT ON COLUMN "tasks"."parentTaskId" IS '상위 태스크 ID';
COMMENT ON COLUMN "tasks"."taskKind" IS '태스크 종류';
COMMENT ON COLUMN "tasks"."changeReason" IS '변경 사유';
COMMENT ON COLUMN "tasks"."createdAt" IS '생성일시';
COMMENT ON COLUMN "tasks"."updatedAt" IS '수정일시';

-- task_prompts
COMMENT ON COLUMN "task_prompts"."id" IS '프롬프트 ID';
COMMENT ON COLUMN "task_prompts"."taskId" IS '태스크 ID';
COMMENT ON COLUMN "task_prompts"."projectId" IS '프로젝트 ID';
COMMENT ON COLUMN "task_prompts"."promptText" IS '프롬프트 본문';
COMMENT ON COLUMN "task_prompts"."version" IS '버전';
COMMENT ON COLUMN "task_prompts"."status" IS '상태';
COMMENT ON COLUMN "task_prompts"."createdAt" IS '생성일시';
COMMENT ON COLUMN "task_prompts"."updatedAt" IS '수정일시';

-- task_runs
COMMENT ON COLUMN "task_runs"."id" IS '실행 ID';
COMMENT ON COLUMN "task_runs"."taskId" IS '태스크 ID';
COMMENT ON COLUMN "task_runs"."taskPromptId" IS '프롬프트 ID';
COMMENT ON COLUMN "task_runs"."status" IS '상태';
COMMENT ON COLUMN "task_runs"."resultText" IS '결과 텍스트';
COMMENT ON COLUMN "task_runs"."resultJson" IS '결과 JSON';
COMMENT ON COLUMN "task_runs"."createdAt" IS '생성일시';
COMMENT ON COLUMN "task_runs"."updatedAt" IS '수정일시';

-- git_change_requests
COMMENT ON COLUMN "git_change_requests"."id" IS '요청 ID';
COMMENT ON COLUMN "git_change_requests"."projectId" IS '프로젝트 ID';
COMMENT ON COLUMN "git_change_requests"."taskId" IS '태스크 ID';
COMMENT ON COLUMN "git_change_requests"."taskRunId" IS '태스크 실행 ID';
COMMENT ON COLUMN "git_change_requests"."status" IS '요청 상태';
COMMENT ON COLUMN "git_change_requests"."requestNote" IS '요청 메모';
COMMENT ON COLUMN "git_change_requests"."files" IS '변경 파일 목록(JSON)';
COMMENT ON COLUMN "git_change_requests"."diffText" IS 'diff 텍스트';
COMMENT ON COLUMN "git_change_requests"."commitMessage" IS '커밋 메시지';
COMMENT ON COLUMN "git_change_requests"."applyStatus" IS '반영 상태';
COMMENT ON COLUMN "git_change_requests"."applyLog" IS '반영 로그';
COMMENT ON COLUMN "git_change_requests"."branchName" IS '브랜치명';
COMMENT ON COLUMN "git_change_requests"."applyStartedAt" IS '반영 시작 시각';
COMMENT ON COLUMN "git_change_requests"."applyFinishedAt" IS '반영 종료 시각';
COMMENT ON COLUMN "git_change_requests"."retryCount" IS '재시도 횟수';
COMMENT ON COLUMN "git_change_requests"."lastError" IS '마지막 오류';
COMMENT ON COLUMN "git_change_requests"."lastRetryAt" IS '마지막 재시도 시각';
COMMENT ON COLUMN "git_change_requests"."rejectionReason" IS '반려 사유';
COMMENT ON COLUMN "git_change_requests"."pullRequestUrl" IS 'Pull Request URL';
COMMENT ON COLUMN "git_change_requests"."pullRequestNumber" IS 'Pull Request 번호';
COMMENT ON COLUMN "git_change_requests"."pullRequestState" IS 'PR 상태';
COMMENT ON COLUMN "git_change_requests"."reviewStatus" IS '리뷰 상태 요약';
COMMENT ON COLUMN "git_change_requests"."mergedAt" IS '머지 시각';
COMMENT ON COLUMN "git_change_requests"."createdAt" IS '생성일시';
COMMENT ON COLUMN "git_change_requests"."updatedAt" IS '수정일시';

-- task_histories
COMMENT ON COLUMN "task_histories"."id" IS '이력 ID';
COMMENT ON COLUMN "task_histories"."projectId" IS '프로젝트 ID';
COMMENT ON COLUMN "task_histories"."taskId" IS '태스크 ID';
COMMENT ON COLUMN "task_histories"."actorType" IS '행위자 유형';
COMMENT ON COLUMN "task_histories"."actorId" IS '행위자 ID';
COMMENT ON COLUMN "task_histories"."eventType" IS '이벤트 유형';
COMMENT ON COLUMN "task_histories"."summary" IS '요약';
COMMENT ON COLUMN "task_histories"."detailJson" IS '상세 JSON';
COMMENT ON COLUMN "task_histories"."createdAt" IS '생성일시';
