/**
 * Preview 검토용 샘플데이터 기준 — 기획 산출물 `requirementsStateJson.sampleDataSpecV1`.
 */

export type SampleDataEntitySpecV1 = Readonly<{
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly minimumCount: number;
  readonly requiredFields: readonly string[];
}>;

export type SampleDataStatusSpecV1 = Readonly<{
  readonly key: string;
  readonly label: string;
  readonly description: string;
}>;

export type SampleDataScenarioSpecV1 = Readonly<{
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly requiredEntities: readonly string[];
}>;

export type SampleDataEmptyStateSpecV1 = Readonly<{
  readonly key: string;
  readonly description: string;
}>;

export type SampleDataSpecV1 = Readonly<{
  readonly version: 1;
  readonly purpose: string;
  readonly entities: readonly SampleDataEntitySpecV1[];
  readonly requiredStatuses: readonly SampleDataStatusSpecV1[];
  readonly requiredScenarios: readonly SampleDataScenarioSpecV1[];
  readonly emptyStates: readonly SampleDataEmptyStateSpecV1[];
  readonly previewValidationCriteria: readonly string[];
}>;

export type SampleDataReadinessV1 = Readonly<{
  readonly status: "READY" | "NEEDS_REVIEW" | "INSUFFICIENT";
  readonly missingEntities: readonly string[];
  readonly missingScenarios: readonly string[];
  readonly missingStatuses: readonly string[];
  readonly notes: string;
}>;

function readString(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readStringArray(raw: unknown, maxItems = 48): readonly string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => readString(x, 500)).filter(Boolean).slice(0, maxItems);
}

function parseEntity(raw: unknown): SampleDataEntitySpecV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = readString(o.key, 80);
  const name = readString(o.name, 200);
  if (!key || !name) return null;
  const minimumCount =
    typeof o.minimumCount === "number" && Number.isFinite(o.minimumCount)
      ? Math.max(0, Math.floor(o.minimumCount))
      : 0;
  return {
    key,
    name,
    description: readString(o.description, 2000),
    minimumCount,
    requiredFields: readStringArray(o.requiredFields, 24),
  };
}

export function parseSampleDataSpecV1(raw: unknown): SampleDataSpecV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const purpose = readString(o.purpose, 4000);
  const entities = (Array.isArray(o.entities) ? o.entities : [])
    .map(parseEntity)
    .filter((x): x is SampleDataEntitySpecV1 => Boolean(x));
  if (!purpose || entities.length === 0) return null;

  const requiredStatuses = (Array.isArray(o.requiredStatuses) ? o.requiredStatuses : [])
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const key = readString(r.key, 80);
      const label = readString(r.label, 200);
      if (!key || !label) return null;
      return {
        key,
        label,
        description: readString(r.description, 2000),
      };
    })
    .filter((x): x is SampleDataStatusSpecV1 => Boolean(x));

  const requiredScenarios = (Array.isArray(o.requiredScenarios) ? o.requiredScenarios : [])
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const key = readString(r.key, 80);
      const name = readString(r.name, 200);
      if (!key || !name) return null;
      return {
        key,
        name,
        description: readString(r.description, 2000),
        requiredEntities: readStringArray(r.requiredEntities, 16),
      };
    })
    .filter((x): x is SampleDataScenarioSpecV1 => Boolean(x));

  const emptyStates = (Array.isArray(o.emptyStates) ? o.emptyStates : [])
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const key = readString(r.key, 80);
      if (!key) return null;
      return { key, description: readString(r.description, 2000) };
    })
    .filter((x): x is SampleDataEmptyStateSpecV1 => Boolean(x));

  return {
    version: 1,
    purpose,
    entities,
    requiredStatuses,
    requiredScenarios,
    emptyStates,
    previewValidationCriteria: readStringArray(o.previewValidationCriteria, 24),
  };
}

export function evaluateSampleDataSpecReadiness(spec: SampleDataSpecV1 | null | undefined): SampleDataReadinessV1 {
  if (!spec) {
    return {
      status: "INSUFFICIENT",
      missingEntities: ["sampleDataSpecV1"],
      missingScenarios: ["sampleDataSpecV1"],
      missingStatuses: ["sampleDataSpecV1"],
      notes: "Preview 검토용 샘플데이터 기준이 아직 정의되지 않았습니다.",
    };
  }

  const missingEntities: string[] = [];
  const missingStatuses: string[] = [];
  const missingScenarios: string[] = [];

  for (const entity of spec.entities) {
    if (entity.minimumCount < 1) missingEntities.push(`${entity.key}:minimumCount`);
    if (!entity.requiredFields.length) missingEntities.push(`${entity.key}:requiredFields`);
  }
  if (!spec.requiredStatuses.length) missingStatuses.push("requiredStatuses");
  if (!spec.requiredScenarios.length) missingScenarios.push("requiredScenarios");
  if (!spec.previewValidationCriteria.length) missingScenarios.push("previewValidationCriteria");

  if (missingEntities.length || missingStatuses.length || missingScenarios.length) {
    const severe = missingEntities.some((m) => m.includes("minimumCount")) || !spec.entities.length;
    return {
      status: severe ? "INSUFFICIENT" : "NEEDS_REVIEW",
      missingEntities,
      missingScenarios,
      missingStatuses,
      notes: severe
        ? "샘플데이터 엔티티·최소 수량 기준을 보완해야 Preview 검토가 가능합니다."
        : "샘플데이터 상태·시나리오 기준을 검토해 주세요.",
    };
  }

  return {
    status: "READY",
    missingEntities: [],
    missingScenarios: [],
    missingStatuses: [],
    notes: "Preview 검토용 샘플데이터 기준이 확정되었습니다.",
  };
}

export const MEETING_WORKSPACE_SAMPLE_DATA_SPEC_V1: SampleDataSpecV1 = {
  version: 1,
  purpose:
    "Preview에서 회의 파일 업로드, 녹취 처리, 요약 완료, 실패 상태, 다운로드 가능 상태를 사용자가 확인할 수 있도록 한다.",
  entities: [
    {
      key: "meetingFiles",
      name: "회의 파일",
      description: "업로드된 회의 음성/영상 파일",
      minimumCount: 5,
      requiredFields: ["id", "title", "fileName", "uploadedAt", "status", "durationMinutes"],
    },
    {
      key: "participants",
      name: "참여자",
      description: "회의 참석자 및 발언자",
      minimumCount: 5,
      requiredFields: ["id", "name", "role", "department"],
    },
    {
      key: "summaries",
      name: "회의 요약",
      description: "AI가 생성한 회의 요약과 결정사항",
      minimumCount: 3,
      requiredFields: ["meetingId", "summary", "actionItems", "decisions"],
    },
    {
      key: "transcripts",
      name: "녹취 텍스트",
      description: "발화자별 녹취 텍스트",
      minimumCount: 3,
      requiredFields: ["meetingId", "speaker", "text", "timestamp"],
    },
  ],
  requiredStatuses: [
    { key: "uploaded", label: "업로드 완료", description: "파일은 업로드됐지만 처리 전 상태" },
    { key: "transcribing", label: "녹취 중", description: "STT 처리 중 상태" },
    { key: "summarized", label: "요약 완료", description: "회의록 확인/다운로드 가능 상태" },
    { key: "failed", label: "처리 실패", description: "변환 실패 및 재시도 필요 상태" },
  ],
  requiredScenarios: [
    {
      key: "normal_completed_meeting",
      name: "정상 완료 회의",
      description: "녹취와 요약이 완료되어 회의록을 볼 수 있는 케이스",
      requiredEntities: ["meetingFiles", "participants", "summaries", "transcripts"],
    },
    {
      key: "processing_meeting",
      name: "처리 중 회의",
      description: "녹취 또는 요약이 진행 중인 케이스",
      requiredEntities: ["meetingFiles"],
    },
    {
      key: "failed_transcription",
      name: "녹취 실패 회의",
      description: "실패 상태와 재시도 안내가 보이는 케이스",
      requiredEntities: ["meetingFiles"],
    },
    {
      key: "downloadable_minutes",
      name: "회의록 다운로드 가능",
      description: "요약 완료 후 다운로드 액션을 확인할 수 있는 케이스",
      requiredEntities: ["meetingFiles", "summaries"],
    },
    {
      key: "empty_initial_state",
      name: "빈 상태",
      description: "아직 업로드된 회의가 없을 때 안내가 보이는 케이스",
      requiredEntities: [],
    },
  ],
  emptyStates: [{ key: "no_meetings", description: "회의 파일이 없을 때 업로드 유도 문구 표시" }],
  previewValidationCriteria: [
    "회의 목록이 5개 이상 표시된다.",
    "요약 완료 상태와 처리 중 상태가 구분된다.",
    "실패 상태가 표시된다.",
    "참여자 정보가 보인다.",
    "요약과 액션아이템이 보인다.",
    "회의록 다운로드 가능 상태가 보인다.",
  ],
};

export function isMeetingWorkspacePlanningContext(text: string): boolean {
  const hay = text.toLowerCase();
  return /회의|녹취|meeting|transcript|요약|스크립트|화자/.test(hay);
}

export function resolveSampleDataSpecV1ForPlanning(input: Readonly<{
  readonly existingSpec?: SampleDataSpecV1 | null;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
}>): SampleDataSpecV1 {
  if (input.existingSpec) return input.existingSpec;
  const hay = `${input.projectName ?? ""} ${input.projectDescription ?? ""}`;
  if (isMeetingWorkspacePlanningContext(hay)) return MEETING_WORKSPACE_SAMPLE_DATA_SPEC_V1;
  return {
    version: 1,
    purpose: "Preview에서 핵심 화면·데이터·상태를 사용자가 검토할 수 있도록 충분한 샘플데이터를 제공한다.",
    entities: [
      {
        key: "primaryRecords",
        name: "핵심 데이터",
        description: "목록/상세 화면에 표시되는 대표 데이터",
        minimumCount: 3,
        requiredFields: ["id", "title", "status", "updatedAt"],
      },
    ],
    requiredStatuses: [
      { key: "active", label: "정상", description: "정상 처리 완료 상태" },
      { key: "pending", label: "처리 중", description: "진행 중 상태" },
      { key: "failed", label: "실패", description: "실패·재시도 필요 상태" },
    ],
    requiredScenarios: [
      {
        key: "happy_path",
        name: "정상 흐름",
        description: "대표 데이터가 목록·상세에 표시되는 경우",
        requiredEntities: ["primaryRecords"],
      },
      {
        key: "empty_state",
        name: "빈 상태",
        description: "데이터가 없을 때 안내",
        requiredEntities: [],
      },
    ],
    emptyStates: [{ key: "no_data", description: "데이터 없음 안내" }],
    previewValidationCriteria: ["목록에 샘플 데이터가 3건 이상 표시된다.", "상태값이 구분되어 보인다."],
  };
}

const ENTITY_EXPORT_BY_KEY: Readonly<Record<string, string>> = {
  meetingFiles: "sampleMeetingFiles",
  participants: "sampleParticipants",
  summaries: "sampleMeetingSummary",
  transcripts: "sampleTranscriptSegments",
  primaryRecords: "sampleMeetingFiles",
};

function countExportRecords(content: string, exportName: string): number {
  const blockRe = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*(\\[[\\s\\S]*?\\]|\\{[\\s\\S]*?\\})`,
    "m",
  );
  const match = content.match(blockRe);
  if (!match?.[1]) return 0;
  const block = match[1].trim();
  if (block.startsWith("[")) {
    return (block.match(/\{\s*/g) ?? []).length;
  }
  return block.length > 20 ? 1 : 0;
}

export function evaluateSampleDataFileContentAgainstSpec(input: Readonly<{
  readonly spec: SampleDataSpecV1;
  readonly sampleDataFileContent: string;
}>): Readonly<{ readonly ok: boolean; readonly missing: readonly string[] }> {
  const content = input.sampleDataFileContent;
  const missing: string[] = [];

  for (const entity of input.spec.entities) {
    const exportName = ENTITY_EXPORT_BY_KEY[entity.key] ?? entity.key;
    const count = countExportRecords(content, exportName);
    if (count < entity.minimumCount) {
      missing.push(`${entity.key}:count<${entity.minimumCount}`);
    }
    for (const field of entity.requiredFields) {
      if (!new RegExp(`\\b${field}\\b`).test(content)) {
        missing.push(`${entity.key}:field:${field}`);
      }
    }
  }

  for (const status of input.spec.requiredStatuses) {
    if (!content.includes(status.key)) {
      missing.push(`status:${status.key}`);
    }
  }

  return { ok: missing.length === 0, missing };
}
