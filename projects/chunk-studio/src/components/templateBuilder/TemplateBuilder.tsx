"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type { JobDetailDTO } from "@/types/job";
import type {
  TemplateApplyPreview,
  TemplateAutoDetectResponse,
  TemplateDiffResponse,
  TemplateRecommendResponse,
} from "@/types/template";
import { useTemplateBuilderStore } from "@/store/templateBuilderStore";
import ContextMenu from "./ContextMenu";
import DocumentCanvas from "./DocumentCanvas";
import TemplateTree from "./TemplateTree";
import TemplateDiffViewer from "./TemplateDiffViewer";
import TemplateOutline from "./TemplateOutline";
import TemplateWarnings from "./TemplateWarnings";
import TemplateDriftViewer from "./TemplateDriftViewer";
import FeedbackSummary from "./FeedbackSummary";
import PipelineBar from "./PipelineBar";
import { buildTemplateOutline } from "@/lib/template/outlineBuilder";
import { validateTemplateDraft } from "@/lib/template/validateTemplateDraft";
import type { DriftItem, DriftResult } from "@/lib/templateDrift/driftTypes";
import type {
  TemplateFeedbackEvent,
  FeedbackEventType,
  FeedbackTargetType,
} from "@/lib/templateFeedback/feedbackTypes";

const saveSchema = z.object({
  family: z.string().min(1),
  name: z.string().min(1),
  docType: z.enum([
    "weekly_report",
    "monthly_report",
    "meeting_minutes",
    "form",
    "unknown",
  ]),
  sections: z.array(z.object({ title: z.string().min(1), level: z.number() })).min(1),
});

const LABEL_CANDIDATES = [
  "성명",
  "연락처",
  "주소",
  "부서",
  "직위",
  "입사일",
  "사직예정일",
  "사직사유",
  "E-mail",
];

function suggestLabel(
  extractedText: string,
  type: "section" | "field" | "table" | "repeat" | "signature" | "date",
  existingLabels: string[]
): string {
  if (type === "signature") return "서명";
  if (type === "date") return "작성일자";
  if (type === "table") return "표";
  if (type === "repeat") return "반복 블록";
  if (type === "section") return "섹션";
  const text = extractedText || "";
  const found =
    LABEL_CANDIDATES.find(
      (candidate) => text.includes(candidate) && !existingLabels.includes(candidate)
    ) ?? "필드";
  return found;
}

interface TemplateBuilderProps {
  jobId: string;
  family: string;
}

interface TemplateListItem {
  templateId: string;
  name: string;
  docType: "weekly_report" | "monthly_report" | "meeting_minutes" | "form" | "unknown";
  latestVersion: string;
  updatedAt: string;
}

interface TemplateSchemaDTO {
  templateId: string;
  name: string;
  family: string;
  docType: "weekly_report" | "monthly_report" | "meeting_minutes" | "form" | "unknown";
  version: string;
  anchors: Array<{ type: "text" | "regex"; value: string; weight: number }>;
  sections: Array<{
    id: string;
    title: string;
    level: number;
    required: boolean;
    parentId?: string;
    orderHint?: number;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
  fields: Array<{
    key: string;
    label: string;
    required: boolean;
    sectionId?: string;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
  tables: Array<{
    id: string;
    headerLabels: string[];
    required: boolean;
    sectionId?: string;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
  repeatBlocks: Array<{
    id: string;
    pattern: string;
    sectionId?: string;
    min?: number;
    max?: number;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
}

interface DriftHistoryItem {
  docId: string;
  severity: "low" | "medium" | "high";
  score: number;
  updatedAt: string;
}

interface FeedbackAliasItem {
  from: string;
  to: string;
  count: number;
  enabled: boolean;
}

export default function TemplateBuilder({ jobId, family }: TemplateBuilderProps) {
  const [doc, setDoc] = useState<JobDetailDTO | null>(null);
  const [recommend, setRecommend] = useState<TemplateRecommendResponse | null>(null);
  const [templateName, setTemplateName] = useState("새 템플릿");
  const [docType, setDocType] = useState<
    "weekly_report" | "monthly_report" | "meeting_minutes" | "form" | "unknown"
  >("unknown");
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    bbox: { page: number; x: number; y: number; w: number; h: number };
    parentSectionId?: string;
  } | null>(null);
  const [preview, setPreview] = useState<TemplateApplyPreview | null>(null);
  const [saved, setSaved] = useState<{ templateId: string; version: string } | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [autoDraft, setAutoDraft] = useState<TemplateAutoDetectResponse | null>(null);
  const [compareDocId, setCompareDocId] = useState("");
  const [diffResult, setDiffResult] = useState<TemplateDiffResponse | null>(null);
  const [allowLowConfidenceAuto, setAllowLowConfidenceAuto] = useState(false);
  const [autoBanner, setAutoBanner] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<
    "edit" | "outline" | "warnings" | "feedback" | "drift" | "diff" | "graph"
  >("edit");
  const [graphSummary, setGraphSummary] = useState<{
    nodes: number;
    edges: number;
    sections: string[];
    fields: string[];
    diffs: string[];
  } | null>(null);
  const [lastAutoDetectTime, setLastAutoDetectTime] = useState<number | null>(null);
  const [driftResult, setDriftResult] = useState<DriftResult | null>(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftMessage, setDriftMessage] = useState<string | null>(null);
  const [driftHistory, setDriftHistory] = useState<DriftHistoryItem[]>([]);
  const [driftContinueConfirmed, setDriftContinueConfirmed] = useState(false);
  const [allowHighDriftAuto, setAllowHighDriftAuto] = useState(false);
  const [templateFamilyInput, setTemplateFamilyInput] = useState(family);
  const [templateList, setTemplateList] = useState<TemplateListItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [feedbackAliases, setFeedbackAliases] = useState<{
    labels: FeedbackAliasItem[];
    sections: FeedbackAliasItem[];
    source: string;
  }>({ labels: [], sections: [], source: "feedback" });
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const structuralRefreshInitRef = useRef(false);
  const structuralRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    sections,
    fields,
    tables,
    anchors,
    repeatBlocks,
    moveSection,
    updateSection,
    deleteSection,
    updateField,
    deleteField,
    updateTable,
    deleteTable,
    updateRepeatBlock,
    deleteRepeatBlock,
    addByType,
    addChildByType,
    addAnchor,
    addRepeatBlock,
    pendingSelection,
    setPendingSelection,
    clearPendingSelection,
    applyDraftTemplate,
    applyTemplateSchema,
    resetAll,
  } = useTemplateBuilderStore();

  useEffect(() => {
    if (!jobId) return;
    fetch(`/api/jobs/${jobId}`)
      .then(async (res) => (res.ok ? ((await res.json()) as JobDetailDTO) : null))
      .then((payload) => setDoc(payload))
      .catch(() => setDoc(null));

    fetch("/api/templates/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, family }),
    })
      .then(async (res) =>
        res.ok ? ((await res.json()) as TemplateRecommendResponse) : null
      )
      .then((payload) => {
        if (!payload) return;
        setRecommend(payload);
        setDocType(payload.profile.docType);
      })
      .catch(() => null);

    fetch(`/api/templates?family=${encodeURIComponent(family)}`)
      .then(async (res) =>
        res.ok ? ((await res.json()) as { templates?: TemplateListItem[] }) : null
      )
      .then((payload) => {
        const next = payload?.templates ?? [];
        setTemplateList(next);
        setSelectedTemplateId((prev) => {
          const exists = next.some((item) => item.templateId === prev);
          return exists ? prev : next[0]?.templateId || "";
        });
        setSelectedVersion((prev) => {
          if (!next.length) return "";
          if (prev) return prev;
          return next[0]?.latestVersion || "";
        });
      })
      .catch(() => null);

    return () => resetAll();
  }, [jobId, family, resetAll]);

  const refreshTemplateList = useCallback(async () => {
    const targetFamily = templateFamilyInput.trim() || family;
    const res = await fetch(`/api/templates?family=${encodeURIComponent(targetFamily)}`);
    if (!res.ok) {
      setTemplateList([]);
      return;
    }
    const payload = (await res.json()) as { templates?: TemplateListItem[] };
    const next = Array.isArray(payload.templates) ? payload.templates : [];
    setTemplateList(next);
    const hasSelected = next.some((item) => item.templateId === selectedTemplateId);
    const nextSelectedId = hasSelected ? selectedTemplateId : next[0]?.templateId || "";
    setSelectedTemplateId(nextSelectedId);
    setSelectedVersion(() => {
      const matched = next.find((item) => item.templateId === nextSelectedId);
      return matched?.latestVersion || "";
    });
  }, [templateFamilyInput, family, selectedTemplateId]);

  const sectionBoxes = useMemo(
    () =>
      sections
        .filter((s) => Boolean(s.bboxHint))
        .map((s) => ({
          id: s.id,
          page: s.bboxHint!.page,
          x: s.bboxHint!.x,
          y: s.bboxHint!.y,
          w: s.bboxHint!.w,
          h: s.bboxHint!.h,
        })),
    [sections]
  );

  const otherBoxes = useMemo(
    () => {
      const fieldBoxes = fields
        .filter((f) => Boolean(f.bboxHint))
        .map((f) => ({
          id: f.key,
          page: f.bboxHint!.page,
          x: f.bboxHint!.x,
          y: f.bboxHint!.y,
          w: f.bboxHint!.w,
          h: f.bboxHint!.h,
        }));
      const tableBoxes = tables
        .map((t, idx) => ({ t, idx }))
        .filter(({ t }) => Boolean(t.bboxHint))
        .map(({ t, idx }) => ({
          id: t.id || `tbl_${idx + 1}`,
          page: t.bboxHint!.page,
          x: t.bboxHint!.x,
          y: t.bboxHint!.y,
          w: t.bboxHint!.w,
          h: t.bboxHint!.h,
        }));
      const repeatBoxes = repeatBlocks
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => Boolean(r.bboxHint))
        .map(({ r, idx }) => ({
          id: r.id || `rep_${idx + 1}`,
          page: r.bboxHint!.page,
          x: r.bboxHint!.x,
          y: r.bboxHint!.y,
          w: r.bboxHint!.w,
          h: r.bboxHint!.h,
        }));
      return [...fieldBoxes, ...tableBoxes, ...repeatBoxes];
    },
    [fields, tables, repeatBlocks]
  );

  const onContextSelect = (
    type: "section" | "field" | "table" | "repeat" | "signature" | "date",
    name?: string
  ) => {
    if (!menu) return;
    const parentSectionId = menu.parentSectionId;
    const isChildType =
      type === "field" ||
      type === "table" ||
      type === "repeat" ||
      type === "signature" ||
      type === "date";
    if (isChildType && !parentSectionId) {
      alert("먼저 상위 Section을 생성하거나, 기존 Section을 선택한 뒤 하위 요소를 추가해주세요.");
      return;
    }
    const existing = fields.map((f) => f.label).concat(sections.map((s) => s.title));
    const fallbackName = suggestLabel(doc?.extractedText ?? "", type, existing);
    const finalName = name?.trim() || fallbackName;
    addByType({
      type,
      name: finalName,
      bbox: menu.bbox,
      sectionId: parentSectionId,
    });
    if (type === "section") {
      logFeedback({
        eventType: "SECTION_ADD",
        targetType: "section",
        afterValue: finalName,
      });
    } else if (type === "table") {
      logFeedback({
        eventType: "TABLE_ADD",
        targetType: "table",
        afterValue: finalName,
      });
    } else if (type === "repeat") {
      logFeedback({
        eventType: "REPEAT_ADD",
        targetType: "repeat",
        afterValue: finalName,
      });
    } else {
      logFeedback({
        eventType: "FIELD_ADD",
        targetType: "field",
        afterValue: finalName,
      });
    }
    clearPendingSelection();
    setFocusedNodeId(null);
    setMenu(null);
  };

  const suggestFieldLabelsNearSelection = useMemo(() => {
    const text = doc?.extractedText ?? "";
    if (!text.trim() || !pendingSelection) {
      return LABEL_CANDIDATES.filter((label) => !fields.some((f) => f.label === label)).slice(0, 6);
    }
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return ["필드"];
    const centerY = pendingSelection.y + pendingSelection.h / 2;
    const centerIdx = Math.max(0, Math.min(lines.length - 1, Math.round(centerY * (lines.length - 1))));
    const windowStart = Math.max(0, centerIdx - 8);
    const windowEnd = Math.min(lines.length, centerIdx + 9);
    const aroundText = lines.slice(windowStart, windowEnd).join(" ");
    const found = LABEL_CANDIDATES.filter(
      (candidate) =>
        aroundText.includes(candidate) &&
        !fields.some((f) => f.label === candidate)
    );
    const fallback = LABEL_CANDIDATES.filter(
      (candidate) => !fields.some((f) => f.label === candidate)
    );
    return [...new Set([...found, ...fallback, "필드"])].slice(0, 8);
  }, [doc?.extractedText, pendingSelection, fields]);

  const resolveParentSectionForBBox = (bbox: {
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }): string | undefined => {
    const focusedSectionId = sections.some((s) => s.id === focusedNodeId)
      ? focusedNodeId ?? undefined
      : fields.find((f) => f.key === focusedNodeId)?.sectionId ||
        tables.find((t) => t.id === focusedNodeId)?.sectionId ||
        repeatBlocks.find((r) => r.id === focusedNodeId)?.sectionId;
    if (focusedSectionId) return focusedSectionId;

    const cx = bbox.x + bbox.w / 2;
    const cy = bbox.y + bbox.h / 2;
    const candidates = sections
      .filter((section) => Boolean(section.bboxHint) && section.bboxHint!.page === bbox.page)
      .filter((section) => {
        const s = section.bboxHint!;
        return cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h;
      })
      .sort((a, b) => {
        const areaA = (a.bboxHint?.w ?? 1) * (a.bboxHint?.h ?? 1);
        const areaB = (b.bboxHint?.w ?? 1) * (b.bboxHint?.h ?? 1);
        return areaA - areaB;
      });
    return candidates[0]?.id;
  };

  const logFeedback = useCallback(
    (input: {
      eventType: FeedbackEventType;
      targetType: FeedbackTargetType;
      targetId?: string;
      beforeValue?: string;
      afterValue?: string;
    }) => {
      const targetFamily = templateFamilyInput.trim() || family;
      const targetTemplateId = saved?.templateId || selectedTemplateId || "unspecified";
      const payload: TemplateFeedbackEvent = {
        eventType: input.eventType,
        family: targetFamily,
        docType,
        templateId: targetTemplateId,
        docId: jobId,
        beforeValue: input.beforeValue,
        afterValue: input.afterValue,
        targetType: input.targetType,
        targetId: input.targetId,
        timestamp: new Date().toISOString(),
      };
      void fetch("/api/templates/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);
    },
    [templateFamilyInput, family, saved?.templateId, selectedTemplateId, docType, jobId]
  );

  const handleUpdateSection = useCallback(
    (id: string, patch: Parameters<typeof updateSection>[1]) => {
      const prev = sections.find((section) => section.id === id);
      updateSection(id, patch);
      if (prev && typeof patch.title === "string" && patch.title.trim() && patch.title !== prev.title) {
        logFeedback({
          eventType: "SECTION_RENAME",
          targetType: "section",
          targetId: id,
          beforeValue: prev.title,
          afterValue: patch.title,
        });
      }
    },
    [sections, updateSection, logFeedback]
  );

  const handleUpdateField = useCallback(
    (key: string, patch: Parameters<typeof updateField>[1]) => {
      const prev = fields.find((field) => field.key === key);
      updateField(key, patch);
      if (prev && typeof patch.label === "string" && patch.label.trim() && patch.label !== prev.label) {
        logFeedback({
          eventType: "FIELD_RELABEL",
          targetType: "field",
          targetId: key,
          beforeValue: prev.label,
          afterValue: patch.label,
        });
      }
    },
    [fields, updateField, logFeedback]
  );

  const handleDeleteSection = useCallback(
    (id: string) => {
      const prev = sections.find((section) => section.id === id);
      deleteSection(id);
      logFeedback({
        eventType: "SECTION_REMOVE",
        targetType: "section",
        targetId: id,
        beforeValue: prev?.title,
      });
    },
    [sections, deleteSection, logFeedback]
  );

  const handleDeleteField = useCallback(
    (key: string) => {
      const prev = fields.find((field) => field.key === key);
      deleteField(key);
      logFeedback({
        eventType: "FIELD_REMOVE",
        targetType: "field",
        targetId: key,
        beforeValue: prev?.label,
      });
    },
    [fields, deleteField, logFeedback]
  );

  const handleDeleteTable = useCallback(
    (id: string) => {
      const prev = tables.find((table) => table.id === id);
      deleteTable(id);
      logFeedback({
        eventType: "TABLE_REMOVE",
        targetType: "table",
        targetId: id,
        beforeValue: prev?.name,
      });
    },
    [tables, deleteTable, logFeedback]
  );

  const handleDeleteRepeatBlock = useCallback(
    (id: string) => {
      const prev = repeatBlocks.find((repeat) => repeat.id === id);
      deleteRepeatBlock(id);
      logFeedback({
        eventType: "REPEAT_REMOVE",
        targetType: "repeat",
        targetId: id,
        beforeValue: prev?.name,
      });
    },
    [repeatBlocks, deleteRepeatBlock, logFeedback]
  );

  const outlineModel = useMemo(
    () =>
      buildTemplateOutline({
        templateName,
        docType,
        sections: sections.map((section) => ({
          id: section.id,
          title: section.title,
          required: section.required,
          orderHint: section.orderHint,
        })),
        fields: fields.map((field) => ({
          key: field.key,
          label: field.label,
          sectionId: field.sectionId,
        })),
        tables: tables.map((table) => ({
          id: table.id,
          name: table.name,
          sectionId: table.sectionId,
        })),
        repeatBlocks: repeatBlocks.map((repeat) => ({
          id: repeat.id,
          name: repeat.name,
          sectionId: repeat.sectionId,
          pattern: repeat.pattern,
          min: repeat.min,
          max: repeat.max,
        })),
      }),
    [templateName, docType, sections, fields, tables, repeatBlocks]
  );

  const draftValidation = useMemo(
    () =>
      validateTemplateDraft({
        docType,
        sections: sections.map((section) => ({
          id: section.id,
          title: section.title,
          bboxHint: section.bboxHint,
        })),
        fields: fields.map((field) => ({
          key: field.key,
          label: field.label,
          sectionId: field.sectionId,
          bboxHint: field.bboxHint,
        })),
        tables: tables.map((table) => ({
          id: table.id,
          name: table.name,
          sectionId: table.sectionId,
          bboxHint: table.bboxHint,
        })),
        repeatBlocks: repeatBlocks.map((repeat) => ({
          id: repeat.id,
          name: repeat.name,
          pattern: repeat.pattern,
          sectionId: repeat.sectionId,
          bboxHint: repeat.bboxHint,
        })),
      }),
    [docType, sections, fields, tables, repeatBlocks]
  );

  const refreshPreviewFromCurrentDraft = useCallback(async () => {
    if (sections.length === 0) {
      setPreview(null);
      return;
    }
    const res = await fetch("/api/templates/apply-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        family,
        draft: {
          docType,
          sections: sections.map((section) => ({
            title: section.title,
            level: section.level,
            bbox: section.bboxHint,
          })),
          fields: fields.map((field) => ({
            label: field.label,
            bbox: field.bboxHint,
          })),
          tables: tables.map((table) => ({
            name: table.name,
            headerLabels: table.headerLabels,
            bbox: table.bboxHint,
          })),
        },
      }),
    });
    if (res.ok) {
      setPreview((await res.json()) as TemplateApplyPreview);
    }
  }, [sections, fields, tables, docType, jobId, family]);

  useEffect(() => {
    if (!structuralRefreshInitRef.current) {
      structuralRefreshInitRef.current = true;
      return;
    }
    if (structuralRefreshTimerRef.current) {
      clearTimeout(structuralRefreshTimerRef.current);
    }
    structuralRefreshTimerRef.current = setTimeout(() => {
      void refreshPreviewFromCurrentDraft();
    }, 400);
    return () => {
      if (structuralRefreshTimerRef.current) {
        clearTimeout(structuralRefreshTimerRef.current);
      }
    };
  }, [sections.length, tables.length, repeatBlocks.length, refreshPreviewFromCurrentDraft]);

  const saveTemplate = async (asNewVersion: boolean) => {
    if (draftValidation.errors.length > 0) {
      alert("오류를 먼저 해결한 뒤 저장해주세요.");
      return;
    }
    if (asNewVersion && !saved?.templateId) {
      alert("새 버전 저장은 먼저 Save 후 사용해주세요.");
      return;
    }
    const check = saveSchema.safeParse({
      family,
      name: templateName,
      docType,
      sections,
    });
    if (!check.success || !recommend) {
      alert("섹션 1개 이상을 정의해야 저장할 수 있습니다.");
      return;
    }

    if (anchors.length === 0 && recommend.profile.anchorCandidates[0]) {
      addAnchor({
        type: "text",
        value: recommend.profile.anchorCandidates[0].text,
        weight: 0.8,
      });
    }
    if (repeatBlocks.length === 0) {
      addRepeatBlock({
        id: "rep_default",
        name: "기본 반복 블록",
        pattern: "^\\d\\)\\s",
        min: 0,
        max: 100,
      });
    }

    const res = await fetch("/api/templates/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        family,
        name: templateName,
        docType,
        templateId: saved?.templateId,
        profile: recommend.profile,
        selections: { sections, fields, tables, anchors, repeatBlocks },
      }),
    });
    if (!res.ok) {
      alert("템플릿 저장 실패");
      return;
    }
    const payload = (await res.json()) as { templateId: string; version: string };
    setSaved(payload);
    setSelectedTemplateId(payload.templateId);
    setSelectedVersion(payload.version);
    await refreshTemplateList();

    const applyRes = await fetch("/api/templates/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        family,
        templateId: payload.templateId,
        version: payload.version,
      }),
    });
    if (applyRes.ok) {
      setPreview((await applyRes.json()) as TemplateApplyPreview);
    }
  };

  const handleLoadTemplate = async () => {
    const targetFamily = templateFamilyInput.trim() || family;
    const templateId = selectedTemplateId.trim();
    const version = selectedVersion.trim();
    if (!templateId || !version) {
      alert("family/templateId/version을 모두 지정해주세요.");
      return;
    }
    const res = await fetch(
      `/api/templates/${encodeURIComponent(templateId)}?family=${encodeURIComponent(targetFamily)}&version=${encodeURIComponent(version)}`
    );
    if (!res.ok) {
      alert("템플릿 로드 실패");
      return;
    }
    const payload = (await res.json()) as { template?: TemplateSchemaDTO };
    if (!payload.template) {
      alert("템플릿 데이터가 비어 있습니다.");
      return;
    }
    applyTemplateSchema({
      sections: payload.template.sections,
      fields: payload.template.fields,
      tables: payload.template.tables,
      anchors: payload.template.anchors,
      repeatBlocks: payload.template.repeatBlocks,
    });
    setTemplateName(payload.template.name);
    setDocType(payload.template.docType);
    setSaved({
      templateId: payload.template.templateId,
      version: payload.template.version,
    });
    setSelectedTemplateId(payload.template.templateId);
    setSelectedVersion(payload.template.version);
    setTemplateFamilyInput(payload.template.family);
  };

  const handleQuickAddChild = (
    sectionId: string,
    type: "field" | "table" | "repeat",
    name: string
  ) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addChildByType({ sectionId, type, name: trimmed });
    if (type === "table") {
      logFeedback({
        eventType: "TABLE_ADD",
        targetType: "table",
        afterValue: trimmed,
      });
    } else if (type === "repeat") {
      logFeedback({
        eventType: "REPEAT_ADD",
        targetType: "repeat",
        afterValue: trimmed,
      });
    } else {
      logFeedback({
        eventType: "FIELD_ADD",
        targetType: "field",
        afterValue: trimmed,
      });
    }
  };

  const handleAutoDetect = async () => {
    const res = await fetch(`/api/templates/auto-detect${showDebug ? "?debug=1" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: jobId, family }),
    });
    if (!res.ok) {
      alert("자동 템플릿 제안 실패");
      return;
    }
    const payload = (await res.json()) as TemplateAutoDetectResponse;
    setAutoDraft(payload);
    setLastAutoDetectTime((prev) => (prev ?? 0) + 1);
    if (payload.docType) setDocType(payload.docType);
  };

  const runDraftPreview = async (draft: TemplateAutoDetectResponse) => {
    const res = await fetch("/api/templates/apply-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        family,
        draft: {
          docType: draft.docType,
          sections: draft.sections,
          fields: draft.fields,
          tables: draft.tables,
        },
      }),
    });
    if (res.ok) {
      setPreview((await res.json()) as TemplateApplyPreview);
    }
  };

  const handleOneClickAutoApply = async () => {
    const driftTemplateId = saved?.templateId || selectedTemplateId.trim();
    const driftTemplateVersion = saved?.version || selectedVersion.trim();
    if (driftTemplateId && driftTemplateVersion) {
      const drift = await runDriftCheck({ silent: true });
      if (drift && (drift.severity === "high" || drift.score >= 0.7)) {
        if (!(showDebug && allowHighDriftAuto)) {
          setAutoBanner(
            "템플릿과 문서 구조 차이가 큽니다. 먼저 Drift 탭에서 확인 후 적용하세요."
          );
          setRightPanelTab("drift");
          return;
        }
      }
    }

    const res = await fetch(`/api/templates/auto-detect${showDebug ? "?debug=1" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: jobId, family }),
    });
    if (!res.ok) {
      setAutoBanner("자동 적용 실패: 자동 템플릿 제안을 가져오지 못했습니다.");
      return;
    }
    const payload = (await res.json()) as TemplateAutoDetectResponse;
    setAutoDraft(payload);
    setLastAutoDetectTime((prev) => (prev ?? 0) + 1);
    if (payload.docType) setDocType(payload.docType);

    if (payload.confidence < 0.65 && !allowLowConfidenceAuto) {
      setAutoBanner("검출 신뢰도 낮음 — 섹션을 먼저 확인 후 수동 적용하세요.");
      return;
    }

    applyDraftTemplate({
      sections: payload.sections.map((section, idx) => ({
        title: section.title,
        level: section.level ?? 1,
        required: true,
        orderHint: idx + 1,
        bboxHint: section.bbox,
      })),
      fields: payload.fields.map((field, idx) => ({
        label: field.label,
        key: `field_${idx + 1}`,
        required: false,
        bboxHint: field.bbox,
      })),
      tables: payload.tables.map((table) => ({
        name: table.name,
        headerLabels: table.headerLabels,
        required: false,
        bboxHint: table.bbox,
      })),
    });
    await runDraftPreview(payload);
    setAutoBanner("자동 적용 완료 — 필요 시 드래그로 수정하세요.");
  };

  const loadDriftHistory = useCallback(async () => {
    const templateId = saved?.templateId || selectedTemplateId.trim();
    const version = saved?.version || selectedVersion.trim();
    const targetFamily = templateFamilyInput.trim() || family;
    if (!templateId || !version) {
      setDriftHistory([]);
      return;
    }
    const res = await fetch(
      `/api/templates/drift?family=${encodeURIComponent(targetFamily)}&templateId=${encodeURIComponent(templateId)}&version=${encodeURIComponent(version)}`
    );
    if (!res.ok) {
      setDriftHistory([]);
      return;
    }
    const payload = (await res.json()) as { items?: DriftHistoryItem[] };
    setDriftHistory(Array.isArray(payload.items) ? payload.items : []);
  }, [saved, selectedTemplateId, selectedVersion, templateFamilyInput, family]);

  const loadFeedbackAliases = useCallback(async () => {
    const targetFamily = templateFamilyInput.trim() || family;
    setFeedbackLoading(true);
    const res = await fetch(
      `/api/feedback/aliases?family=${encodeURIComponent(targetFamily)}&docType=${encodeURIComponent(docType)}`
    );
    setFeedbackLoading(false);
    if (!res.ok) return;
    const payload = (await res.json()) as {
      labels?: FeedbackAliasItem[];
      sections?: FeedbackAliasItem[];
      source?: string;
    };
    setFeedbackAliases({
      labels: Array.isArray(payload.labels) ? payload.labels : [],
      sections: Array.isArray(payload.sections) ? payload.sections : [],
      source: payload.source ?? "feedback",
    });
  }, [templateFamilyInput, family, docType]);

  const runDriftCheck = async (opts?: { silent?: boolean }): Promise<DriftResult | null> => {
    const templateId = saved?.templateId || selectedTemplateId.trim();
    const version = saved?.version || selectedVersion.trim();
    const targetFamily = templateFamilyInput.trim() || family;
    if (!templateId || !version) {
      if (!opts?.silent) {
        setDriftMessage("드리프트 검사를 위해 templateId/version이 필요합니다.");
      }
      return null;
    }
    setDriftLoading(true);
    if (!opts?.silent) {
      setDriftMessage(null);
    }
    const res = await fetch("/api/templates/drift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        family: targetFamily,
        templateId,
        version,
        docId: jobId,
        options: { debug: showDebug },
      }),
    });
    setDriftLoading(false);
    if (!res.ok) {
      if (!opts?.silent) {
        setDriftMessage("드리프트 검사 실패");
      }
      return null;
    }
    const payload = (await res.json()) as {
      drift?: DriftResult;
      autoDetect?: { confidence?: number; docType?: string };
    };
    if (!payload.drift) {
      if (!opts?.silent) {
        setDriftMessage("드리프트 응답이 비어 있습니다.");
      }
      return null;
    }
    setDriftResult(payload.drift);
    setDriftContinueConfirmed(false);
    void loadDriftHistory();
    if (!opts?.silent) {
      setDriftMessage(
        `검출 docType=${payload.autoDetect?.docType ?? "-"}, confidence=${payload.autoDetect?.confidence ?? "-"}`
      );
    }
    return payload.drift;
  };

  const handleApplyAutoDraft = () => {
    if (!autoDraft) return;
    applyDraftTemplate({
      sections: autoDraft.sections.map((section, idx) => ({
        title: section.title,
        level: section.level ?? 1,
        required: true,
        orderHint: idx + 1,
        bboxHint: section.bbox,
      })),
      fields: autoDraft.fields.map((field, idx) => ({
        label: field.label,
        key: `field_${idx + 1}`,
        required: false,
        bboxHint: field.bbox,
      })),
      tables: autoDraft.tables.map((table) => ({
        name: table.name,
        headerLabels: table.headerLabels,
        required: false,
        bboxHint: table.bbox,
      })),
    });
    void runDraftPreview(autoDraft);
  };

  const handleRunDiff = async () => {
    if (!saved?.templateId || !compareDocId.trim()) {
      alert("비교 문서 ID와 저장된 템플릿이 필요합니다.");
      return;
    }
    const res = await fetch("/api/templates/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docAId: jobId,
        docBId: compareDocId.trim(),
        templateId: saved.templateId,
        version: saved.version,
        family,
      }),
    });
    if (!res.ok) {
      alert("템플릿 기반 문서 비교 실패");
      return;
    }
    setDiffResult((await res.json()) as TemplateDiffResponse);
  };

  const handleBuildGraph = async () => {
    if (!saved?.templateId) {
      alert("그래프 생성을 위해 템플릿 저장이 필요합니다.");
      return;
    }
    const res = await fetch("/api/graphs/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        family,
        docId: jobId,
        templateId: saved.templateId,
        version: saved.version,
      }),
    });
    if (!res.ok) {
      alert("그래프 생성 실패");
      return;
    }
    await handleLoadGraph();
  };

  const handleLoadGraph = async () => {
    const res = await fetch(`/api/graphs?family=${encodeURIComponent(family)}&docId=${encodeURIComponent(jobId)}`);
    if (!res.ok) return;
    const payload = (await res.json()) as {
      nodes: Array<{ type: string; label: string }>;
      edges: Array<{ type: string }>;
    };
    setGraphSummary({
      nodes: payload.nodes.length,
      edges: payload.edges.length,
      sections: payload.nodes.filter((n) => n.type === "section").map((n) => n.label).slice(0, 5),
      fields: payload.nodes.filter((n) => n.type === "field").map((n) => n.label).slice(0, 8),
      diffs: payload.nodes.filter((n) => n.type === "diffEvent").map((n) => n.label).slice(0, 8),
    });
  };

  const handleGraphDiff = async () => {
    if (!saved?.templateId || !compareDocId.trim()) {
      alert("그래프 diff를 위해 템플릿 저장 및 비교 문서 ID가 필요합니다.");
      return;
    }
    const res = await fetch("/api/graphs/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        family,
        docAId: jobId,
        docBId: compareDocId.trim(),
        templateId: saved.templateId,
        version: saved.version,
      }),
    });
    if (!res.ok) {
      alert("그래프 diff 반영 실패");
      return;
    }
    await handleLoadGraph();
  };

  const confidenceLabel = autoDraft
    ? autoDraft.confidence >= 0.8
      ? "높음"
      : autoDraft.confidence >= 0.65
        ? "중간"
        : "낮음"
    : null;

  const pipelineSteps = useMemo(() => {
    const checks = [
      { key: "upload", label: "Upload", done: Boolean(jobId) },
      { key: "auto-detect", label: "Auto Detect", done: Boolean(lastAutoDetectTime) },
      { key: "build-template", label: "Build Template", done: sections.length > 0 },
      { key: "preview", label: "Preview", done: Boolean(preview?.chunks?.length) },
      { key: "diff", label: "Diff", done: Boolean(diffResult) },
      { key: "graph", label: "Graph", done: Boolean(graphSummary) },
    ];
    const currentIdx = checks.findIndex((step) => !step.done);
    return checks.map((step, idx) => ({
      key: step.key,
      label: step.label,
      status:
        step.done
          ? "done"
          : currentIdx === -1
            ? "todo"
            : idx === currentIdx
              ? "current"
              : "todo",
    })) as Array<{ key: string; label: string; status: "done" | "current" | "todo" }>;
  }, [jobId, lastAutoDetectTime, sections.length, preview, diffResult, graphSummary]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid #ddd",
          padding: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13 }}>
          <strong>Template Builder</strong> · drag → type → confirm
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            style={{ fontSize: 12, padding: "6px 8px" }}
          >
            고급/디버그 {showDebug ? "ON" : "OFF"}
          </button>
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            style={{ fontSize: 12, padding: 6, minWidth: 180 }}
            placeholder="템플릿 이름"
          />
          <select
            value={docType}
            onChange={(e) =>
              setDocType(
                e.target.value as
                  | "weekly_report"
                  | "monthly_report"
                  | "meeting_minutes"
                  | "form"
                  | "unknown"
              )
            }
            style={{ fontSize: 12, padding: 6 }}
          >
            <option value="weekly_report">weekly_report</option>
            <option value="monthly_report">monthly_report</option>
            <option value="meeting_minutes">meeting_minutes</option>
            <option value="form">form</option>
            <option value="unknown">unknown</option>
          </select>
          <button
            onClick={() => void saveTemplate(false)}
            disabled={draftValidation.errors.length > 0}
            title={
              draftValidation.errors.length > 0
                ? draftValidation.errors.map((error) => error.message).join(" / ")
                : undefined
            }
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void saveTemplate(true)}
            disabled={draftValidation.errors.length > 0}
          >
            Save New Version
          </button>
          <button type="button" onClick={() => void refreshPreviewFromCurrentDraft()}>
            미리보기 갱신
          </button>
          <button type="button" onClick={handleAutoDetect}>
            자동 템플릿 제안
          </button>
          <button type="button" onClick={handleOneClickAutoApply}>
            원클릭 자동 적용
          </button>
          {showDebug && (
            <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={allowLowConfidenceAuto}
                onChange={(e) => setAllowLowConfidenceAuto(e.target.checked)}
              />
              낮은 신뢰도에서도 적용
            </label>
          )}
          {showDebug && (
            <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={allowHighDriftAuto}
                onChange={(e) => setAllowHighDriftAuto(e.target.checked)}
              />
              드리프트 높아도 적용
            </label>
          )}
        </div>
      </header>
      <div
        style={{
          borderBottom: "1px solid #eee",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          fontSize: 12,
        }}
      >
        <span style={{ color: "#666" }}>Template Selector</span>
        <input
          value={templateFamilyInput}
          onChange={(e) => setTemplateFamilyInput(e.target.value)}
          placeholder="family"
          style={{ fontSize: 12, padding: 6, minWidth: 170 }}
        />
        <button type="button" onClick={() => void refreshTemplateList()}>
          목록 새로고침
        </button>
        <select
          value={selectedTemplateId}
          onChange={(e) => {
            const nextId = e.target.value;
            setSelectedTemplateId(nextId);
            const matched = templateList.find((item) => item.templateId === nextId);
            setSelectedVersion(matched?.latestVersion ?? "");
          }}
          style={{ fontSize: 12, padding: 6, minWidth: 220 }}
        >
          <option value="">templateId 선택</option>
          {templateList.map((item) => (
            <option key={item.templateId} value={item.templateId}>
              {item.templateId} ({item.name})
            </option>
          ))}
        </select>
        <input
          value={selectedVersion}
          onChange={(e) => setSelectedVersion(e.target.value)}
          placeholder="version (ex: v0.2)"
          style={{ fontSize: 12, padding: 6, width: 130 }}
        />
        <button type="button" onClick={handleLoadTemplate}>
          Load Template
        </button>
        <span style={{ color: "#666" }}>
          current: {saved?.templateId ?? "-"} / {saved?.version ?? "-"}
        </span>
      </div>
      <PipelineBar steps={pipelineSteps} />

      <main
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.45fr 0.95fr",
          minHeight: 0,
        }}
      >
        <section style={{ borderRight: "1px solid #ddd", padding: 12, minHeight: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              border: "1px solid #dbe8ff",
              background: "#f3f8ff",
              color: "#0d47a1",
              borderRadius: 999,
              padding: "3px 8px",
              marginBottom: 8,
            }}
          >
            Left Workbench: Document Structure + Pages + Preview
          </div>
          <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
            문서에서 영역을 드래그하면 타입 선택 메뉴가 뜹니다. (하위 요소는 Section 내부/선택 상태에서만 생성)
          </div>
          <DocumentCanvas
            pdfUrl={`/api/jobs/${jobId}/pdf`}
            fallbackText={doc?.extractedText}
            sectionBoxes={sectionBoxes}
            otherBoxes={otherBoxes}
            focusedBoxId={focusedNodeId}
            onSelectionComplete={(bbox, at) =>
              {
                setPendingSelection(bbox);
                setMenu({
                  ...at,
                  bbox,
                  parentSectionId: resolveParentSectionForBBox(bbox),
                });
              }
            }
          />
        </section>

        <section style={{ padding: 12, minHeight: 0, overflow: "auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              border: "1px solid #e2e2e2",
              background: "#fafafa",
              color: "#555",
              borderRadius: 999,
              padding: "3px 8px",
              marginBottom: 8,
            }}
          >
            Right Workbench: Semantic Chunk Review / Diff / Drift
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {([
              ["edit", "Edit"],
              ["outline", "Outline"],
              ["warnings", "Warnings"],
              ["feedback", "Feedback"],
              ["drift", "Drift"],
              ["diff", "Diff"],
              ["graph", "Graph"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setRightPanelTab(id);
                  if (id === "drift") {
                    void loadDriftHistory();
                  }
                  if (id === "feedback") {
                    void loadFeedbackAliases();
                  }
                }}
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  border: "1px solid #ddd",
                  borderRadius: 999,
                  background: rightPanelTab === id ? "#eef5ff" : "#fff",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {rightPanelTab === "edit" && (
            <>
          <TemplateTree
            templateName={templateName}
            sections={sections}
            fields={fields}
            tables={tables.map((t) => ({
              id: t.id,
              name: t.name,
              sectionId: t.sectionId,
              bboxHint: t.bboxHint,
            }))}
            repeatBlocks={repeatBlocks.map((r) => ({
              id: r.id,
              name: r.name,
              sectionId: r.sectionId,
              bboxHint: r.bboxHint,
            }))}
            onUpdateSection={handleUpdateSection}
            onDeleteSection={handleDeleteSection}
            onUpdateField={handleUpdateField}
            onDeleteField={handleDeleteField}
            onUpdateTable={updateTable}
            onDeleteTable={handleDeleteTable}
            onUpdateRepeatBlock={updateRepeatBlock}
            onDeleteRepeatBlock={handleDeleteRepeatBlock}
            onMoveSection={moveSection}
            onQuickAddChild={handleQuickAddChild}
            onFocusNode={setFocusedNodeId}
            focusedNodeId={focusedNodeId}
          />

          {saved && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#444" }}>
              saved: {saved.templateId} ({saved.version})
            </div>
          )}

          {autoDraft && (
            <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
              <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>
                자동 템플릿 제안 (docType={autoDraft.docType}, conf={autoDraft.confidence})
              </h4>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                검출 신뢰도: {confidenceLabel}
                {confidenceLabel === "낮음"
                  ? " · 섹션 확인 후 적용 권장"
                  : ""}
                {" · top: "}
                {[
                  ...autoDraft.fields.slice(0, 2).map((f) => f.label),
                  ...autoDraft.sections.slice(0, 1).map((s) => s.title),
                ].join(", ")}
              </div>
              <div style={{ fontSize: 12 }}>
                sections {autoDraft.sections.length} / fields {autoDraft.fields.length} / tables{" "}
                {autoDraft.tables.length}
              </div>
              {showDebug && autoDraft.aliasApplied && autoDraft.aliasApplied.length > 0 && (
                <div style={{ fontSize: 12, color: "#1e88e5", marginTop: 4 }}>
                  추천 라벨: {autoDraft.aliasApplied[0]?.split(" -> ")[1] ?? autoDraft.fields[0]?.label ?? "-"} (피드백 보정 적용)
                </div>
              )}
              <button
                type="button"
                onClick={handleApplyAutoDraft}
                style={{ marginTop: 8, fontSize: 12, padding: "6px 8px" }}
              >
                제안 초안 적용
              </button>
            </div>
          )}
          {autoBanner && (
            <div
              style={{
                marginTop: 10,
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 8,
                fontSize: 12,
                background: "#f8fbff",
              }}
            >
              {autoBanner}
            </div>
          )}

          {preview && (
            <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
              <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>청킹 프리뷰</h4>
              <div style={{ fontSize: 12, marginBottom: 6 }}>
                total {preview.chunkMeta.total} / section {preview.chunkMeta.sectionChunks} /
                table {preview.chunkMeta.tableChunks} / repeat{" "}
                {preview.chunkMeta.repeatChunks}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#555",
                  marginBottom: 6,
                  background: "#f8fbff",
                  border: "1px solid #e3efff",
                  borderRadius: 6,
                  padding: "6px 8px",
                }}
              >
                RAG Mapping: chunk text + section/page provenance + quality metadata {"->"} retrieval-ready JSONL
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {preview.chunks.slice(0, 8).map((chunk) => (
                  <div key={chunk.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: 8 }}>
                    <div style={{ fontSize: 12 }}>
                      [{chunk.type}] {chunk.meta.sectionTitle ?? chunk.meta.sectionId ?? "-"}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                      {chunk.text.slice(0, 180)}
                      {chunk.text.length > 180 ? "..." : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {showDebug && (
            <div style={{ marginTop: 12, border: "1px dashed #ccc", borderRadius: 8, padding: 10 }}>
              <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Debug JSON</h4>
              <pre style={{ margin: 0, fontSize: 11, maxHeight: 280, overflow: "auto" }}>
                {JSON.stringify(
                  {
                    sections,
                    fields,
                    tables,
                    repeatBlocks,
                    pendingSelection,
                    saved,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
            </>
          )}

          {rightPanelTab === "outline" && <TemplateOutline outline={outlineModel} />}
          {rightPanelTab === "warnings" && (
            <TemplateWarnings validation={draftValidation} />
          )}
          {rightPanelTab === "feedback" && (
            <FeedbackSummary
              family={templateFamilyInput.trim() || family}
              docType={docType}
              labels={feedbackAliases.labels}
              sections={feedbackAliases.sections}
              loading={feedbackLoading}
              onRefresh={() => {
                void loadFeedbackAliases();
              }}
              onToggle={(input) => {
                void fetch("/api/feedback/aliases/toggle", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    family: templateFamilyInput.trim() || family,
                    docType,
                    ...input,
                  }),
                }).then(() => loadFeedbackAliases());
              }}
            />
          )}
          {rightPanelTab === "drift" && (
            <TemplateDriftViewer
              drift={driftResult}
              recentItems={driftHistory}
              loading={driftLoading}
              message={driftMessage}
              onRun={() => {
                void runDriftCheck();
              }}
              onGuideCreateVersion={() => {
                setAutoBanner(
                  "현재 드리프트 결과를 반영하려면 구조를 수정한 뒤 상단의 Save New Version 버튼으로 새 버전을 저장하세요."
                );
              }}
              onContinueWithCurrentTemplate={() => {
                setDriftContinueConfirmed(true);
                setAutoBanner(null);
                setDriftMessage("현재 템플릿으로 계속 진행하도록 선택했습니다.");
              }}
              onEditInBuilder={() => {
                setRightPanelTab("edit");
                setAutoBanner("Builder 편집 탭에서 구조를 조정한 뒤 다시 Drift를 확인하세요.");
              }}
              onItemClick={(item: DriftItem) => {
                const target =
                  item.ref?.sectionId ||
                  item.ref?.fieldKey ||
                  item.ref?.tableId ||
                  item.ref?.repeatId;
                if (target) {
                  setFocusedNodeId(target);
                }
              }}
            />
          )}
          {rightPanelTab === "drift" && driftContinueConfirmed && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#2e7d32" }}>
              현재 템플릿 유지 진행 상태입니다.
            </div>
          )}

          {(rightPanelTab === "diff" || rightPanelTab === "graph") && (
            <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <h4 style={{ margin: 0, fontSize: 13, flex: 1 }}>
                {rightPanelTab === "diff" ? "Template 기반 문서 비교" : "Template Graph"}
              </h4>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={compareDocId}
                onChange={(e) => setCompareDocId(e.target.value)}
                placeholder="비교 문서 jobId"
                style={{ flex: 1, fontSize: 12, padding: 6 }}
              />
              <button type="button" onClick={handleRunDiff} style={{ fontSize: 12, padding: "6px 8px" }}>
                Diff 실행
              </button>
              <button type="button" onClick={handleBuildGraph} style={{ fontSize: 12, padding: "6px 8px" }}>
                Graph 생성
              </button>
              <button type="button" onClick={handleGraphDiff} style={{ fontSize: 12, padding: "6px 8px" }}>
                Graph Diff 반영
              </button>
            </div>
            {rightPanelTab === "diff" ? (
              <TemplateDiffViewer
                diff={diffResult}
                onFocusSection={(title) => {
                  const matched = sections.find((section) => section.title === title);
                  if (matched) setFocusedNodeId(matched.id);
                }}
              />
            ) : (
              <div style={{ marginTop: 10, fontSize: 12 }}>
                {!graphSummary ? (
                  <div style={{ color: "#666" }}>Graph 없음. Graph 생성을 눌러주세요.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div>
                      nodes {graphSummary.nodes} / edges {graphSummary.edges}
                    </div>
                    <div>Sections: {graphSummary.sections.join(", ") || "-"}</div>
                    <div>Fields: {graphSummary.fields.join(", ") || "-"}</div>
                    <div>Diffs: {graphSummary.diffs.join(", ") || "-"}</div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </section>
      </main>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          suggestedFieldLabels={suggestFieldLabelsNearSelection}
          disabledIds={
            menu.parentSectionId
              ? []
              : ["field", "table", "repeat", "signature", "date"]
          }
          onSelect={onContextSelect}
          onClose={() => {
            clearPendingSelection();
            setMenu(null);
          }}
        />
      )}
    </div>
  );
}

