"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import {
  IDEATION_DELIVERABLE_FULL_PLAN,
  IDEATION_DELIVERABLE_LABELS,
  IDEATION_DELIVERABLE_ORDER,
  type IdeationDeliverableType,
} from "@/lib/requirements/ideationDeliverables";

export type RequirementsComposerToolsMenu = {
  readonly onOrganizeRequirements: () => void;
  readonly organizeDisabled: boolean;
  readonly draftViewAvailable: boolean;
  readonly onOpenDraftView: () => void;
  readonly onOpenPromptView: () => void;
  readonly onOpenSummaryEdit: () => void;
  /** 선택 유형별 산출물 일괄 생성 */
  readonly onGenerateDeliverables?: (types: readonly IdeationDeliverableType[]) => void | Promise<void>;
  readonly deliverableGenerateBusy?: boolean;
  /** 파일명을 입력창에 반영하는 수준의 첨부 UX */
  readonly onAttachFiles?: (files: FileList) => void;
  /** 개발 전용: 하단 단계 이동 제거 후 + 메뉴로만 노출 */
  readonly devAckStep?: { onClick: () => void; disabled: boolean } | null;
};

const MENU_Z = 72;
const DELIVER_PANEL_Z = 92;

export type RequirementsComposerTargetPickerItem = {
  readonly id: string;
  readonly label: string;
  readonly targets: readonly { id: string; name: string }[];
};

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function menuItemStyle(disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
    textAlign: "left",
    padding: "11px 14px",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    fontSize: 14,
    fontWeight: 600,
    color: disabled ? "#94a3b8" : "#0f172a",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function MenuDivider() {
  return <div style={{ height: 1, background: "#f1f5f9", margin: "4px 8px" }} aria-hidden />;
}

function ComposerHubMenuItems({
  tools,
  onPick,
  onOpenDeliverPanel,
  fileInputRef,
}: {
  readonly tools: RequirementsComposerToolsMenu;
  readonly onPick: () => void;
  readonly onOpenDeliverPanel: () => void;
  readonly fileInputRef: MutableRefObject<HTMLInputElement | null>;
}) {
  const canDeliver = Boolean(tools.onGenerateDeliverables);
  return (
    <>
      {canDeliver ? (
        <button
          type="button"
          role="menuitem"
          disabled={Boolean(tools.deliverableGenerateBusy)}
          onClick={() => {
            if (tools.deliverableGenerateBusy) return;
            onOpenDeliverPanel();
            onPick();
          }}
          style={menuItemStyle(Boolean(tools.deliverableGenerateBusy))}
        >
          <span>산출물 생성 (즉시 생성형)</span>
          <span style={{ fontSize: 16, color: "#94a3b8", fontWeight: 700 }} aria-hidden>
            ›
          </span>
        </button>
      ) : null}
      <div style={{ padding: "6px 14px 2px", fontSize: 11, fontWeight: 900, color: "#94a3b8", letterSpacing: "0.02em" }}>
        산출물 작업
      </div>
      {tools.draftViewAvailable ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            tools.onOpenDraftView();
            onPick();
          }}
          style={menuItemStyle(false)}
        >
          정리본 보기
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          tools.onOpenPromptView();
          onPick();
        }}
        style={menuItemStyle(false)}
      >
        프롬프트 보기
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          tools.onOpenSummaryEdit();
          onPick();
        }}
        style={menuItemStyle(false)}
      >
        요약 편집
      </button>
      {tools.onAttachFiles ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            tabIndex={-1}
            style={{ display: "none" }}
            onChange={(e) => {
              const fl = e.target.files;
              if (fl && fl.length) tools.onAttachFiles?.(fl);
              e.target.value = "";
              onPick();
            }}
          />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              fileInputRef.current?.click();
            }}
            style={menuItemStyle(false)}
          >
            파일 첨부
          </button>
        </>
      ) : null}
      <MenuDivider />
      <button
        type="button"
        role="menuitem"
        disabled={tools.organizeDisabled}
        onClick={() => {
          if (tools.organizeDisabled) return;
          tools.onOrganizeRequirements();
          onPick();
        }}
        style={menuItemStyle(tools.organizeDisabled)}
      >
        정리 요청 (플래너 검토형)
      </button>
      {canDeliver ? (
        <div style={{ padding: "0 14px 6px", fontSize: 12, color: "#64748b", lineHeight: 1.35 }}>
          정보를 검토하고 부족한 내용을 질문한 뒤 결과물을 작성합니다.
        </div>
      ) : null}
      {tools.devAckStep ? (
        <button
          type="button"
          role="menuitem"
          disabled={tools.devAckStep.disabled}
          onClick={() => {
            const step = tools.devAckStep;
            if (!step || step.disabled) return;
            step.onClick();
            onPick();
          }}
          style={menuItemStyle(tools.devAckStep.disabled)}
        >
          (DEV) 단계 건너뛰기
        </button>
      ) : null}
    </>
  );
}

export function RequirementsComposerGpt({
  value,
  onChange,
  onSend,
  busy,
  disabled,
  placeholder,
  toolsMenu,
  textAreaRef,
  questionTargets,
  onRemoveQuestionTarget,
  targetPickerItems,
  onAddQuestionTargets,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  /** + 메뉴(정리 요청 등). 없으면 + 버튼 미표시 */
  readonly toolsMenu?: RequirementsComposerToolsMenu;
  /** 부모에서 포커스·커서 제어용(선택) */
  readonly textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  /** 질문 대상 칩(복수) */
  readonly questionTargets?: readonly { id: string; name: string }[];
  readonly onRemoveQuestionTarget?: (memberId: string) => void;
  /** `@@` 입력 시 노출할 질문 대상 선택 팝업 항목 */
  readonly targetPickerItems?: readonly RequirementsComposerTargetPickerItem[];
  /** `@@` 팝업에서 선택한 질문 대상을 상위 상태에 추가 */
  readonly onAddQuestionTargets?: (targets: readonly { id: string; name: string }[]) => void;
}) {
  const showScreenLabels = useShowScreenLabels();
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deliverPanelOpen, setDeliverPanelOpen] = useState(false);
  const [selectedDeliverableTypes, setSelectedDeliverableTypes] = useState(() => new Set<IdeationDeliverableType>());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  const menuId = useId();
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [lastAtAtIndex, setLastAtAtIndex] = useState<number | null>(null);

  const hasTargetPicker = Boolean(targetPickerItems && targetPickerItems.length && onAddQuestionTargets);
  const normalizedTargetPickerItems = useMemo(() => {
    const items = targetPickerItems ?? [];
    const seen = new Set<string>();
    return items.filter((it) => {
      if (!it.targets || it.targets.length === 0) return false;
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    });
  }, [targetPickerItems]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeTargetPicker = useCallback(() => setTargetPickerOpen(false), []);
  const closeDeliverPanel = useCallback(() => {
    setDeliverPanelOpen(false);
    setSelectedDeliverableTypes(new Set());
  }, []);

  const openDeliverPanel = useCallback(() => {
    setDeliverPanelOpen(true);
  }, []);

  const toggleDeliverableType = useCallback((t: IdeationDeliverableType) => {
    setSelectedDeliverableTypes((prev) => {
      const next = new Set(prev);
      if (t === IDEATION_DELIVERABLE_FULL_PLAN) {
        if (next.has(IDEATION_DELIVERABLE_FULL_PLAN)) {
          next.delete(IDEATION_DELIVERABLE_FULL_PLAN);
          return next;
        }
        return new Set<IdeationDeliverableType>([IDEATION_DELIVERABLE_FULL_PLAN]);
      }
      if (next.has(t)) {
        next.delete(t);
        return next;
      }
      next.delete(IDEATION_DELIVERABLE_FULL_PLAN);
      next.add(t);
      return next;
    });
  }, []);

  const runDeliverableGenerate = useCallback(async () => {
    if (!toolsMenu?.onGenerateDeliverables) return;
    const list = [...selectedDeliverableTypes];
    if (!list.length || toolsMenu.deliverableGenerateBusy) return;
    try {
      await Promise.resolve(toolsMenu.onGenerateDeliverables(list));
      closeDeliverPanel();
    } catch (e) {
      if (e instanceof Error && e.message === "GUARD") return;
      /* 기타 오류는 상위 setError 처리 */
    }
  }, [toolsMenu, selectedDeliverableTypes, closeDeliverPanel]);

  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 220;
    el.style.height = `${Math.min(max, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [value, autoGrow]);

  useEffect(() => {
    if (!hasTargetPicker) return;
    const idx = value.lastIndexOf("@@");
    if (idx < 0) {
      setTargetPickerOpen(false);
      setLastAtAtIndex(null);
      return;
    }
    const before = idx === 0 ? "" : value[idx - 1] ?? "";
    const after = value[idx + 2] ?? "";
    const okBefore = !before || /\s/.test(before);
    const okAfter = !after || /\s/.test(after);
    if (!okBefore || !okAfter) {
      setTargetPickerOpen(false);
      setLastAtAtIndex(null);
      return;
    }
    setLastAtAtIndex(idx);
    setTargetPickerOpen(true);
  }, [value, hasTargetPicker]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    const onChange = () => {
      apply();
      setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen && !deliverPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (deliverPanelOpen) closeDeliverPanel();
      else setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, deliverPanelOpen, closeDeliverPanel]);

  useEffect(() => {
    if (!menuOpen || narrow) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (plusRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen, narrow]);

  useEffect(() => {
    if (!menuOpen) return;
    const t = window.setTimeout(() => {
      const root = narrow ? sheetRef.current : popoverRef.current;
      const first = root?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
      first?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [menuOpen, narrow]);

  const hasFullPlanSelected = selectedDeliverableTypes.has(IDEATION_DELIVERABLE_FULL_PLAN);
  const hasNonFullSelected = useMemo(
    () => [...selectedDeliverableTypes].some((x) => x !== IDEATION_DELIVERABLE_FULL_PLAN),
    [selectedDeliverableTypes]
  );

  const pickTargetItem = useCallback(
    (targets: readonly { id: string; name: string }[]) => {
      if (!onAddQuestionTargets) return;
      onAddQuestionTargets(targets);
      if (lastAtAtIndex !== null && lastAtAtIndex >= 0) {
        const before = value.slice(0, lastAtAtIndex);
        const after = value.slice(lastAtAtIndex + 2);
        const next = `${before}${after}`.replace(/\s{2,}/g, " ");
        onChange(next);
      }
      setTargetPickerOpen(false);
      window.setTimeout(() => taRef.current?.focus(), 0);
    },
    [onAddQuestionTargets, lastAtAtIndex, value, onChange]
  );

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 10px 40px -18px rgba(15, 23, 42, 0.18)",
        padding: "12px 14px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {questionTargets && questionTargets.length > 0 ? (
        <div className="relative" style={{ position: "relative" }}>
          <ScreenLabel label="요구사항-입력창-질문대상표시" visible={showScreenLabels} />
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.45 }}>
            <span style={{ fontWeight: 800 }}>질문 대상:</span>{" "}
            <span style={{ fontWeight: 600 }}>{questionTargets.map((t) => t.name).join(", ")}</span>
          </div>
          {onRemoveQuestionTarget ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {questionTargets.map((t) => (
                <span
                  key={t.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px 4px 10px",
                    borderRadius: 999,
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#065f46",
                  }}
                >
                  {t.name}
                  <button
                    type="button"
                    aria-label={`${t.name} 질문 대상에서 제거`}
                    onClick={() => onRemoveQuestionTarget(t.id)}
                    style={{
                      border: "none",
                      background: "rgba(255,255,255,0.65)",
                      borderRadius: 999,
                      width: 20,
                      height: 20,
                      lineHeight: 1,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 900,
                      color: "#047857",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {toolsMenu ? (
          <div className="relative" style={{ position: "relative", flexShrink: 0 }}>
            <ScreenLabel label="요구사항-입력창-액션행" visible={showScreenLabels} />
            <button
              ref={plusRef}
              type="button"
              data-testid="requirements-composer-tools-trigger"
              aria-label="도구 메뉴 열기"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background: "#fafafa",
                color: "#475569",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
              }}
            >
              <PlusIcon />
            </button>
            {menuOpen && !narrow ? (
              <div
                ref={popoverRef}
                id={menuId}
                role="menu"
                aria-label="입력 도구"
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: 0,
                  minWidth: 216,
                  padding: 6,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  boxShadow: "0 12px 40px -12px rgba(15, 23, 42, 0.2)",
                  zIndex: MENU_Z,
                }}
              >
                <ComposerHubMenuItems
                  tools={toolsMenu}
                  onPick={closeMenu}
                  onOpenDeliverPanel={openDeliverPanel}
                  fileInputRef={fileInputRef}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="relative" style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <ScreenLabel label="요구사항-채팅영역-입력창" visible={showScreenLabels} />
          {targetPickerOpen && hasTargetPicker ? (
            <div
              role="dialog"
              aria-label="질문 대상 선택"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: "calc(100% + 8px)",
                padding: 8,
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                background: "#fff",
                boxShadow: "0 18px 50px -18px rgba(15, 23, 42, 0.25)",
                zIndex: MENU_Z,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>
                `@@`로 질문 대상을 선택하세요
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {normalizedTargetPickerItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pickTargetItem(item.targets)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", flexShrink: 0 }}>
                      {item.targets.length}명
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={closeTargetPicker}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#475569",
                    padding: "6px 8px",
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
          ) : null}
          <textarea
            ref={(el) => {
              taRef.current = el;
              if (textAreaRef) textAreaRef.current = el;
            }}
            data-testid="requirements-chat-input"
            value={value}
            disabled={disabled}
            rows={1}
            onChange={(e) => onChange(e.target.value)}
            onInput={autoGrow}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder ?? "무엇을 만들고 싶은지 입력하세요"}
            style={{
              width: "100%",
              boxSizing: "border-box",
              flex: 1,
              minHeight: 44,
              maxHeight: 220,
              resize: "none",
              border: "none",
              outline: "none",
              background: "#f4f4f5",
              borderRadius: 14,
              fontSize: 16,
              lineHeight: 1.5,
              fontFamily: "inherit",
              padding: "12px 14px",
            }}
          />
        </div>
        <div className="relative" style={{ position: "relative", flex: "0 0 auto" }}>
          <ScreenLabel label="요구사항-채팅영역-전송버튼" visible={showScreenLabels} />
          <button
            type="button"
            disabled={busy || disabled}
            title="전송"
            aria-label="전송"
            onClick={onSend}
            style={{
              flex: "0 0 auto",
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "none",
              background: busy || disabled ? "#cbd5e1" : "linear-gradient(180deg, #0f766e 0%, #0d5c56 100%)",
              color: "#fff",
              cursor: busy || disabled ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              lineHeight: 1,
              boxShadow: busy || disabled ? "none" : "0 8px 20px -6px rgba(13, 92, 86, 0.45)",
            }}
          >
            ➤
          </button>
        </div>
      </div>

      {menuOpen && narrow && toolsMenu ? (
        <>
          <button
            type="button"
            aria-label="메뉴 닫기"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: MENU_Z,
              border: 0,
              padding: 0,
              margin: 0,
              background: "rgba(15, 23, 42, 0.35)",
              cursor: "pointer",
            }}
            onClick={closeMenu}
          />
          <div
            ref={sheetRef}
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="입력 도구"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: MENU_Z + 1,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderTop: "1px solid #e2e8f0",
              background: "#fff",
              padding: "10px 12px 20px",
              boxShadow: "0 -8px 32px rgba(15, 23, 42, 0.12)",
              maxHeight: "min(70vh, 420px)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 999,
                background: "#e2e8f0",
                margin: "4px auto 12px",
              }}
              aria-hidden
            />
            <div role="menu" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <ComposerHubMenuItems
                tools={toolsMenu}
                onPick={closeMenu}
                onOpenDeliverPanel={openDeliverPanel}
                fileInputRef={fileInputRef}
              />
            </div>
          </div>
        </>
      ) : null}

      {deliverPanelOpen && toolsMenu?.onGenerateDeliverables ? (
        <>
          <button
            type="button"
            aria-label="산출물 패널 닫기"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: DELIVER_PANEL_Z,
              border: 0,
              padding: 0,
              margin: 0,
              background: "rgba(15, 23, 42, 0.4)",
              cursor: "pointer",
            }}
            onClick={closeDeliverPanel}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="산출물 생성"
            style={{
              position: "fixed",
              left: "max(12px, 50% - min(96vw, 440px) / 2)",
              bottom: "max(12px, 10vh)",
              width: "min(96vw, 440px)",
              maxHeight: "min(78vh, 640px)",
              zIndex: DELIVER_PANEL_Z + 1,
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              background: "#fff",
              boxShadow: "0 24px 64px -18px rgba(15, 23, 42, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>산출물 생성 (즉시 생성형)</div>
              <button
                type="button"
                onClick={closeDeliverPanel}
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 10,
                  padding: "6px 10px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                닫기
              </button>
            </div>
            <div style={{ padding: "12px 16px", overflowY: "auto", flex: 1, minHeight: 0 }}>
              <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.5, marginBottom: 12, fontWeight: 600 }}>
                현재 대화 내용을 기준으로 즉시 생성합니다. 전체 기획안은 종합 산출물이므로 단독 선택만 가능합니다.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {IDEATION_DELIVERABLE_ORDER.map((t) => {
                  const checked = selectedDeliverableTypes.has(t);
                  const rowDisabled =
                    (t === IDEATION_DELIVERABLE_FULL_PLAN && hasNonFullSelected) ||
                    (t !== IDEATION_DELIVERABLE_FULL_PLAN && hasFullPlanSelected);
                  const id = `deliver-type-${t}`;
                  return (
                    <label
                      key={t}
                      htmlFor={id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #e8eef3",
                        background: rowDisabled ? "#f8fafc" : "#fff",
                        cursor: rowDisabled ? "not-allowed" : "pointer",
                        opacity: rowDisabled ? 0.55 : 1,
                      }}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        disabled={rowDisabled}
                        onChange={() => {
                          if (rowDisabled) return;
                          toggleDeliverableType(t);
                        }}
                        style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, cursor: rowDisabled ? "not-allowed" : "pointer" }}
                      />
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.45 }}>{IDEATION_DELIVERABLE_LABELS[t]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #f1f5f9" }}>
              <button
                type="button"
                disabled={!selectedDeliverableTypes.size || Boolean(toolsMenu.deliverableGenerateBusy)}
                onClick={() => void runDeliverableGenerate()}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "none",
                  padding: "12px 14px",
                  fontSize: 15,
                  fontWeight: 900,
                  color: "#fff",
                  cursor:
                    !selectedDeliverableTypes.size || toolsMenu.deliverableGenerateBusy ? "not-allowed" : "pointer",
                  background:
                    !selectedDeliverableTypes.size || toolsMenu.deliverableGenerateBusy
                      ? "#94a3b8"
                      : "linear-gradient(180deg, #0f766e 0%, #0d5c56 100%)",
                  boxShadow: toolsMenu.deliverableGenerateBusy ? "none" : "0 10px 28px -12px rgba(13, 92, 86, 0.45)",
                }}
              >
                {toolsMenu.deliverableGenerateBusy ? "생성 중…" : "선택한 산출물 생성"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
