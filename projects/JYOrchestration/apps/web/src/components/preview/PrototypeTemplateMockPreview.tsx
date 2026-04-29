"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import type { PrototypeTemplate } from "@/lib/templates/prototypeTemplates";

function Pill({ label, tone }: { readonly label: string; readonly tone: "neutral" | "good" | "warn" | "info" }) {
  const style: CSSProperties =
    tone === "good"
      ? {
          ...pill,
          background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
          borderColor: "#34d399",
          color: "#065f46",
          boxShadow: "0 2px 10px rgba(16, 185, 129, 0.25)",
        }
      : tone === "warn"
        ? {
            ...pill,
            background: "linear-gradient(135deg, #ffedd5 0%, #fdba74 100%)",
            borderColor: "#fb923c",
            color: "#9a3412",
            boxShadow: "0 2px 12px rgba(251, 146, 60, 0.35)",
          }
        : tone === "info"
          ? {
              ...pill,
              background: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
              borderColor: "#818cf8",
              color: "#312e81",
              boxShadow: "0 2px 10px rgba(99, 102, 241, 0.22)",
            }
          : {
              ...pill,
              background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, #fae8ff 100%)",
              borderColor: "rgba(167, 139, 250, 0.55)",
              color: "#5b21b6",
              boxShadow: "0 1px 8px rgba(91, 33, 182, 0.12)",
            };
  return <span style={style}>{label}</span>;
}

function MiniCard({
  title,
  value,
  sub,
}: {
  readonly title: string;
  readonly value: string;
  readonly sub?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(167, 139, 250, 0.35)",
        borderRadius: 14,
        padding: 12,
        background: "linear-gradient(155deg, #ffffff 0%, #faf5ff 55%, #fff7ed 100%)",
        boxShadow: "0 4px 20px rgba(91, 33, 182, 0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 950, color: "#6d28d9" }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 1000, color: "#4c1d95" }}>{value}</div>
      {sub ? <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: "#7c3aed" }}>{sub}</div> : null}
    </div>
  );
}

function Frame({
  title,
  subtitle,
  children,
  headerRight,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
  /** 비우면 헤더 우측 슬롯 없음(데코용 배지 미표시). */
  readonly headerRight?: ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(192, 132, 252, 0.5)",
        boxShadow: "0 4px 28px rgba(109, 40, 217, 0.15), 0 0 0 1px rgba(251, 191, 36, 0.2)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(250,245,255,0.95) 100%)",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "linear-gradient(100deg, #312e81 0%, #5b21b6 40%, #7c3aed 70%, #c026d3 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "radial-gradient(circle at 30% 30%, #fca5a5, #ef4444)",
                boxShadow: "0 0 10px rgba(239, 68, 68, 0.65)",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "radial-gradient(circle at 30% 30%, #fde68a, #f59e0b)",
                boxShadow: "0 0 10px rgba(245, 158, 11, 0.55)",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "radial-gradient(circle at 30% 30%, #86efac, #22c55e)",
                boxShadow: "0 0 10px rgba(34, 197, 94, 0.55)",
              }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 1000, color: "#fefce8", textShadow: "0 1px 12px rgba(0,0,0,0.2)" }}>{title}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "rgba(254, 252, 232, 0.88)" }}>{subtitle}</div>
          </div>
        </div>
        {headerRight ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>{headerRight}</div>
        ) : null}
      </div>
      <div
        style={{
          padding: 12,
          background: "linear-gradient(180deg, #fdf4ff 0%, #faf5ff 35%, #eef2ff 100%)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MeetingConversionHeaderCompact() {
  return (
    <>
      <span style={{ fontSize: 11, fontWeight: 950, color: "rgba(254,252,232,0.85)", whiteSpace: "nowrap" }}>변환</span>
      <Pill label="STT 진행" tone="warn" />
      <Pill label="화자 대기" tone="neutral" />
      <Pill label="초안 대기" tone="neutral" />
    </>
  );
}

function MeetingTimelineCompact() {
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid rgba(167, 139, 250, 0.25)",
        flexShrink: 0,
        borderRadius: 12,
        padding: "10px 10px 8px",
        background: "linear-gradient(90deg, rgba(254,243,199,0.35) 0%, rgba(250,232,255,0.5) 50%, rgba(224,231,255,0.4) 100%)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 1000, color: "#5b21b6", marginBottom: 6 }}>초안 생성 타임라인</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", fontSize: 10.5, fontWeight: 850, lineHeight: 1.4 }}>
        <span style={{ color: "#059669" }}>● 업로드</span>
        <span style={{ color: "#a78bfa" }}>→</span>
        <span style={{ color: "#ea580c" }}>● STT</span>
        <span style={{ color: "#a78bfa" }}>→</span>
        <span style={{ color: "#94a3b8" }}>○ 화자</span>
        <span style={{ color: "#a78bfa" }}>→</span>
        <span style={{ color: "#94a3b8" }}>○ 초안</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 800, color: "#6d28d9" }}>STT 63% · 화자 분리 대기</div>
    </div>
  );
}

function MeetingWorkspaceMock() {
  const [resultTab, setResultTab] = useState<"summary" | "script">("summary");
  const [plusModalOpen, setPlusModalOpen] = useState(false);
  return (
    <Frame
      title="회의 분석 워크스페이스"
      subtitle="녹취 업로드 · 변환 · 회의록 초안 · 요약/스크립트"
      headerRight={
        <div
          style={{
            padding: "5px 10px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.2)",
            border: "1px solid rgba(255,255,255,0.2)",
            backdropFilter: "blur(10px)",
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <MeetingConversionHeaderCompact />
        </div>
      }
    >
      <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px, 1fr) minmax(280px, 1.5fr) minmax(180px, 1fr)",
          gap: 12,
          alignItems: "stretch",
          minHeight: 420,
        }}
      >
        <div style={{ ...panel, background: "linear-gradient(165deg, #ffffff 0%, #faf5ff 100%)" }}>
          <div style={panelTitle}>회의 파일</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {[
              { name: "4/20 주간 운영회의.m4a", time: "15:32", tone: "good" as const },
              { name: "4/18 고객 인터뷰.wav", time: "48:11", tone: "warn" as const },
              { name: "4/12 팀 회고.mp3", time: "32:04", tone: "neutral" as const },
            ].map((x) => (
              <div
                key={x.name}
                style={{
                  border: "1px solid rgba(167, 139, 250, 0.35)",
                  borderRadius: 12,
                  padding: 10,
                  background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(254,249,255,0.9) 100%)",
                  boxShadow: "0 2px 12px rgba(91, 33, 182, 0.06)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 950, color: "#4c1d95", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {x.name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 800, color: "#7c3aed" }}>{x.time}</div>
                </div>
                <Pill label={x.tone === "good" ? "완료" : x.tone === "warn" ? "변환 중" : "대기"} tone={x.tone === "good" ? "good" : x.tone === "warn" ? "warn" : "neutral"} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(167, 139, 250, 0.25)" }}>
            <div style={panelTitle}>참여자</div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Pill label="김PM" tone="neutral" />
              <Pill label="이Dev" tone="neutral" />
              <Pill label="박Design" tone="neutral" />
              <Pill label="오Ops" tone="neutral" />
            </div>
          </div>
        </div>

        <div
          style={{
            ...panel,
            background: "linear-gradient(165deg, #ffffff 0%, #fffbeb 45%, #fefce8 100%)",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 420,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexShrink: 0 }}>
            <div style={panelTitle}>작업 공간</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Pill label="선택됨: 4/18 고객 인터뷰" tone="info" />
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              flex: 1,
              minHeight: 200,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "4px 2px 8px",
            }}
          >
            <div style={{ alignSelf: "flex-start", maxWidth: "92%" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#6d28d9", marginBottom: 6 }}>어시스턴트</div>
              <div
                style={{
                  border: "1px solid rgba(129, 140, 248, 0.45)",
                  borderRadius: 14,
                  padding: "10px 12px",
                  background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                  boxShadow: "0 4px 16px rgba(99, 102, 241, 0.15)",
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#312e81",
                  lineHeight: 1.55,
                }}
              >
                4/18 고객 인터뷰 파일 기준으로 STT 변환이 <strong style={{ color: "#c2410c" }}>63%</strong>까지 진행됐어요. 화자 분리는 STT 완료 후 자동으로
                시작됩니다.
              </div>
            </div>
            <div style={{ alignSelf: "flex-end", maxWidth: "88%" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#a21caf", marginBottom: 6, textAlign: "right" }}>나</div>
              <div
                style={{
                  border: "1px solid rgba(244, 114, 182, 0.45)",
                  borderRadius: 14,
                  padding: "10px 12px",
                  background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
                  boxShadow: "0 4px 16px rgba(219, 39, 119, 0.12)",
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#831843",
                  lineHeight: 1.55,
                }}
              >
                결정사항만 먼저 요약해줘.
              </div>
            </div>
            <div style={{ alignSelf: "flex-start", maxWidth: "92%" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#6d28d9", marginBottom: 6 }}>어시스턴트</div>
              <div
                style={{
                  border: "1px solid rgba(129, 140, 248, 0.45)",
                  borderRadius: 14,
                  padding: "10px 12px",
                  background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                  boxShadow: "0 4px 16px rgba(99, 102, 241, 0.15)",
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#312e81",
                  lineHeight: 1.55,
                }}
              >
                요약은 오른쪽 <strong>결과 패널</strong>의 요약본 탭에서 확인할 수 있어요. 스크립트 탭에서는 화자별 발언 예시를 볼 수 있습니다.
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              paddingTop: 12,
              borderTop: "1px solid rgba(167, 139, 250, 0.25)",
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              aria-label="작업 추가"
              onClick={() => setPlusModalOpen(true)}
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: 12,
                border: "1px solid rgba(167, 139, 250, 0.5)",
                background: "linear-gradient(145deg, #ffffff, #faf5ff)",
                color: "#6d28d9",
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 12px rgba(91, 33, 182, 0.12)",
              }}
            >
              +
            </button>
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(167, 139, 250, 0.35)",
                borderRadius: 12,
                padding: "10px 12px",
                background: "linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)",
                color: "#a78bfa",
                fontWeight: 900,
                fontSize: 12.5,
              }}
            >
              질문을 입력해보세요… (예: 결정사항만 요약해줘)
            </div>
            <span
              style={{
                ...btn,
                flexShrink: 0,
                border: "none",
                color: "#fff",
                background: "linear-gradient(120deg, #6d28d9 0%, #a21caf 45%, #db2777 100%)",
                boxShadow: "0 4px 18px rgba(124, 58, 237, 0.45)",
              }}
            >
              전송
            </span>
          </div>
        </div>

        <div
          style={{
            ...panel,
            background: "linear-gradient(165deg, #ffffff 0%, #fdf4ff 50%, #fff7ed 100%)",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 420,
          }}
        >
          <div style={panelTitle}>결과 패널</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setResultTab("summary")}
              style={{
                ...tab,
                cursor: "pointer",
                ...(resultTab === "summary"
                  ? {
                      background: "linear-gradient(120deg, #5b21b6 0%, #7c3aed 50%, #c026d3 100%)",
                      borderColor: "transparent",
                      color: "#fff",
                      boxShadow: "0 4px 16px rgba(91, 33, 182, 0.35)",
                    }
                  : {}),
              }}
            >
              요약본
            </button>
            <button
              type="button"
              onClick={() => setResultTab("script")}
              style={{
                ...tab,
                cursor: "pointer",
                ...(resultTab === "script"
                  ? {
                      background: "linear-gradient(120deg, #5b21b6 0%, #7c3aed 50%, #c026d3 100%)",
                      borderColor: "transparent",
                      color: "#fff",
                      boxShadow: "0 4px 16px rgba(91, 33, 182, 0.35)",
                    }
                  : {}),
              }}
            >
              스크립트
            </button>
          </div>

          <div style={{ marginTop: 12, flex: 1, minHeight: 120, overflowY: "auto", display: "grid", gap: 10, alignContent: "start" }}>
            {resultTab === "summary" ? (
              <>
                <div style={contentCard}>
                  <div style={contentTitle}>핵심 안건</div>
                  <ul style={list}>
                    <li>이번 주 배포 일정 확정 및 리스크 점검</li>
                    <li>고객 피드백 반영 우선순위 재정렬</li>
                  </ul>
                </div>
                <div style={contentCard}>
                  <div style={contentTitle}>결정사항</div>
                  <ul style={list}>
                    <li>4/30(목) 오후 6시 배포 진행</li>
                    <li>로그인 플로우 오류는 핫픽스로 선반영</li>
                  </ul>
                </div>
                <div style={contentCard}>
                  <div style={contentTitle}>할 일</div>
                  <ul style={list}>
                    <li>[이Dev] 로그인 오류 재현 케이스 정리 (오늘)</li>
                    <li>[오Ops] 배포 체크리스트 업데이트 (내일 오전)</li>
                    <li>[김PM] 공지 문안 작성 (내일)</li>
                  </ul>
                </div>
              </>
            ) : (
              <div style={{ ...contentCard, background: "linear-gradient(135deg, #faf5ff 0%, #fff7ed 100%)" }}>
                <div style={contentTitle}>스크립트(화자별 예시)</div>
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  <div style={bubble}>
                    <div style={bubbleWho}>김PM</div>
                    <div>이번 주 배포는 목요일 6시로 가는 게 가능할까요?</div>
                  </div>
                  <div style={bubble}>
                    <div style={bubbleWho}>이Dev</div>
                    <div>로그인 플로우 쪽 이슈만 오늘 안에 핫픽스하면 가능해요.</div>
                  </div>
                  <div style={bubble}>
                    <div style={bubbleWho}>오Ops</div>
                    <div>체크리스트만 업데이트하면 운영 측은 준비됩니다.</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <MeetingTimelineCompact />
        </div>
      </div>

      {plusModalOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPlusModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-plus-modal-title"
            style={{
              width: "min(360px, 100%)",
              background: "linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)",
              borderRadius: 16,
              border: "1px solid rgba(167, 139, 250, 0.45)",
              padding: 16,
              boxShadow: "0 24px 60px rgba(91, 33, 182, 0.25), 0 0 0 1px rgba(251, 191, 36, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="meeting-plus-modal-title" style={{ fontSize: 14, fontWeight: 1000, color: "#0f172a" }}>
              작업 추가
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <button
                type="button"
                onClick={() => setPlusModalOpen(false)}
                style={{
                  ...btn,
                  width: "100%",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  padding: "12px 14px",
                  cursor: "pointer",
                }}
              >
                녹취파일 업로드
              </button>
              <button
                type="button"
                onClick={() => setPlusModalOpen(false)}
                style={{
                  ...btn,
                  width: "100%",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  padding: "12px 14px",
                  cursor: "pointer",
                }}
              >
                회의록 보기
              </button>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setPlusModalOpen(false)} style={{ ...btn, cursor: "pointer" }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>
    </Frame>
  );
}

function DashboardMock() {
  return (
    <Frame title="운영 대시보드" subtitle="KPI · 최근 요청 · 상태 분포 · 활동">
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, minHeight: 420 }}>
        <div
          style={{
            ...panel,
            background: "linear-gradient(165deg, #1e1034 0%, #312e81 55%, #4c1d95 100%)",
            borderColor: "rgba(167, 139, 250, 0.35)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 1000, color: "#fde68a" }}>내비게이션</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {["대시보드", "요청 관리", "사용자 관리", "통계", "설정"].map((x, i) => (
              <div
                key={x}
                style={{
                  padding: "10px 10px",
                  borderRadius: 12,
                  background: i === 0 ? "rgba(192,132,252,0.35)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(253, 224, 71, 0.2)",
                  color: "#fefce8",
                  fontSize: 12.5,
                  fontWeight: 950,
                }}
              >
                {x}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(226,232,240,0.15)" }}>
            <div style={{ fontSize: 11.5, fontWeight: 900, color: "#94a3b8" }}>오늘 처리 목표</div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 1000, color: "#fff" }}>24건</div>
          </div>
        </div>

        <div style={{ ...panel, background: "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={panelTitle}>대시보드</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Pill label="기간: 최근 7일" tone="neutral" />
              <Pill label="필터: 전체" tone="neutral" />
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            <MiniCard title="승인 대기" value="7" sub="어제 대비 +2" />
            <MiniCard title="진행 중" value="12" sub="SLA 위험 3건" />
            <MiniCard title="최근 요청" value="28" sub="7일 합계" />
            <MiniCard title="사용자 수" value="1,204" sub="활성 312" />
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>최근 요청 리스트</div>
                <Pill label="정렬: 최신" tone="neutral" />
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {[
                  { title: "GitHub PR 머지 실패 조사", who: "플랫폼", status: "승인 대기", tone: "warn" as const },
                  { title: "프로토타입 생성(회의 분석)", who: "프로젝트 A", status: "진행 중", tone: "info" as const },
                  { title: "요구사항 문서 업데이트", who: "프로젝트 B", status: "완료", tone: "good" as const },
                ].map((x) => (
                  <div key={x.title} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 950, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {x.title}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 800, color: "#64748b" }}>{x.who}</div>
                    </div>
                    <Pill label={x.status} tone={x.tone === "good" ? "good" : x.tone === "warn" ? "warn" : "info"} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>상태 분포</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {[
                    { label: "승인 대기", pct: 28, color: "#f59e0b" },
                    { label: "진행 중", pct: 52, color: "#3b82f6" },
                    { label: "완료", pct: 20, color: "#22c55e" },
                  ].map((x) => (
                    <div key={x.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>
                        <span>{x.label}</span>
                        <span style={{ color: "#64748b" }}>{x.pct}%</span>
                      </div>
                      <div style={{ marginTop: 6, height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${x.pct}%`, height: "100%", background: x.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>활동</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {[
                    { t: "방금", m: "프로토타입 실행이 PR_OPENED 상태로 변경됨" },
                    { t: "12분 전", m: "GitHub 권한 검증 성공" },
                    { t: "37분 전", m: "회의록 템플릿 추천됨 (키워드 3개 매칭)" },
                  ].map((x) => (
                    <div key={x.m} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 900, color: "#64748b" }}>{x.t}</div>
                      <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>{x.m}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function BookingMock() {
  return (
    <Frame title="예약 서비스" subtitle="캘린더 · 시간 선택 · 신청/확인">
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12, minHeight: 420 }}>
        <div style={{ ...panel, background: "#ffffff" }}>
          <div style={panelTitle}>예약 메뉴</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {["예약하기", "예약 내역", "상담 문의", "관리자 일정"].map((x, i) => (
              <div key={x} style={{ ...navItem, background: i === 0 ? "#eff6ff" : "#f8fafc", borderColor: i === 0 ? "#bfdbfe" : "#e2e8f0", color: i === 0 ? "#1e40af" : "#0f172a" }}>
                {x}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, ...subPanel }}>
            <div style={subTitle}>상담 유형</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={chipRow}>
                <Pill label="제품 데모" tone="info" />
                <Pill label="기술 상담" tone="neutral" />
              </div>
              <div style={chipRow}>
                <Pill label="요금제 문의" tone="neutral" />
                <Pill label="기타" tone="neutral" />
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...panel, background: "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={panelTitle}>예약하기</div>
            <Pill label="담당자: 김상담" tone="neutral" />
          </div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 360px", gap: 12 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>예약 캘린더</div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                  <div key={d} style={{ fontSize: 11.5, fontWeight: 950, color: "#64748b", textAlign: "center" }}>
                    {d}
                  </div>
                ))}
                {Array.from({ length: 28 }).map((_, i) => {
                  const day = i + 1;
                  const selected = day === 18;
                  const disabled = day % 6 === 0;
                  return (
                    <div
                      key={day}
                      style={{
                        height: 34,
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        background: selected
                          ? "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)"
                          : disabled
                            ? "#f1f5f9"
                            : "#fff",
                        color: selected ? "#fff" : disabled ? "#94a3b8" : "#0f172a",
                        fontSize: 12.5,
                        fontWeight: 950,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>시간 선택</div>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {["10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30"].map((t, i) => (
                    <div
                      key={t}
                      style={{
                        padding: "10px 10px",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        background: i === 5 ? "#eff6ff" : "#f8fafc",
                        color: i === 5 ? "#1e40af" : "#0f172a",
                        fontSize: 12.5,
                        fontWeight: 950,
                        textAlign: "center",
                      }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>예약 신청</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div style={mockInput}>이름 (예: 홍길동)</div>
                  <div style={mockInput}>연락처 (예: 010-1234-5678)</div>
                  <div style={mockInput}>요청사항 (선택)</div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <Pill label="선택: 4/18 14:30" tone="info" />
                    <span
                      style={{
                        ...btn,
                        background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
                        color: "#fff",
                        borderColor: "transparent",
                        boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                      }}
                    >
                      예약 확정
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function MarketplaceMock() {
  return (
    <Frame title="마켓플레이스" subtitle="상품 · 검색/필터 · 장바구니 · 주문">
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12, minHeight: 420 }}>
        <div style={{ ...panel, background: "#ffffff" }}>
          <div style={panelTitle}>카테고리</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {["추천", "신규", "인기", "카테고리", "판매자센터"].map((x, i) => (
              <div key={x} style={{ ...navItem, background: i === 0 ? "#f0fdf4" : "#f8fafc", borderColor: i === 0 ? "#bbf7d0" : "#e2e8f0", color: "#0f172a" }}>
                {x}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, ...subPanel }}>
            <div style={subTitle}>필터</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={chipRow}>
                <Pill label="무료배송" tone="neutral" />
                <Pill label="즉시구매" tone="neutral" />
              </div>
              <div style={chipRow}>
                <Pill label="평점 4+" tone="neutral" />
                <Pill label="세일" tone="warn" />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, ...subPanel }}>
            <div style={subTitle}>장바구니</div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <Pill label="2개 담김" tone="info" />
              <span style={btn}>주문하기</span>
            </div>
          </div>
        </div>

        <div style={{ ...panel, background: "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={panelTitle}>상품 목록</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ ...mockInput, width: 240 }}>검색 (예: 노트북 거치대)</div>
              <span
                style={{
                  ...btn,
                  background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
                  color: "#fff",
                  borderColor: "transparent",
                  boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                }}
              >
                검색
              </span>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {[
              { name: "알루미늄 노트북 거치대", price: "29,000원", tag: "추천" as const },
              { name: "무선 키보드(저소음)", price: "49,000원", tag: "인기" as const },
              { name: "USB-C 허브 7in1", price: "39,000원", tag: "세일" as const },
              { name: "업무용 모니터 27인치", price: "219,000원", tag: "추천" as const },
              { name: "인체공학 마우스", price: "59,000원", tag: "인기" as const },
              { name: "케이블 정리 키트", price: "9,900원", tag: "세일" as const },
            ].map((p) => (
              <div key={p.name} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff", display: "grid", gap: 10 }}>
                <div style={{ height: 76, borderRadius: 12, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)" }} />
                <div style={{ fontSize: 12.5, fontWeight: 950, color: "#0f172a", lineHeight: 1.35 }}>{p.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 1000, color: "#0f172a" }}>{p.price}</div>
                  <Pill label={p.tag} tone={p.tag === "세일" ? "warn" : "info"} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={btn}>상세</span>
                  <span
                    style={{
                      ...btn,
                      background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
                      borderColor: "transparent",
                      color: "#fff",
                      boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                    }}
                  >
                    담기
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function LandingMock() {
  return (
    <Frame title="랜딩 페이지" subtitle="Hero · 기능 · 후기 · CTA">
      <div style={{ ...panel, background: "#ffffff" }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, background: "linear-gradient(135deg, #ecfeff 0%, #ffffff 55%, #f0fdf4 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 1000, color: "#0f172a" }}>서비스 이름</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["소개", "기능", "가격", "문의"].map((x) => (
                <span key={x} style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", padding: "6px 10px", borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff" }}>
                  {x}
                </span>
              ))}
              <span
                style={{
                  ...btn,
                  background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
                  borderColor: "transparent",
                  color: "#fff",
                  boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                }}
              >
                가입
              </span>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 1100, color: "#0f172a", lineHeight: 1.2 }}>
                회의 분석을 한 화면에서.
                <br />
                업로드부터 요약까지 자동으로.
              </div>
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "#475569", lineHeight: 1.55 }}>
                녹취 파일을 업로드하면 STT 변환 · 화자 분리 · 요약/결정/할 일이 자동 생성됩니다.
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    ...btn,
                    background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
                    borderColor: "transparent",
                    color: "#fff",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                  }}
                >
                  무료로 시작하기
                </span>
                <span style={btn}>데모 보기</span>
                <Pill label="14일 무료 체험" tone="good" />
              </div>
            </div>
            <div style={{ height: 190, borderRadius: 16, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #ffffff 0%, #eef2ff 55%, #f8fafc 100%)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 14, borderRadius: 14, border: "1px solid rgba(148,163,184,0.55)", background: "rgba(255,255,255,0.65)" }} />
              <div style={{ position: "absolute", left: 24, top: 24, width: 90, height: 12, borderRadius: 999, background: "rgba(59,130,246,0.25)" }} />
              <div style={{ position: "absolute", left: 24, top: 46, width: 160, height: 12, borderRadius: 999, background: "rgba(34,197,94,0.18)" }} />
              <div style={{ position: "absolute", left: 24, top: 74, right: 24, height: 86, borderRadius: 14, border: "1px solid rgba(226,232,240,0.9)", background: "rgba(248,250,252,0.9)" }} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <MiniCard title="핵심 기능" value="업로드→요약" sub="자동 변환 파이프라인" />
          <MiniCard title="팀 협업" value="댓글/공유" sub="회의록 링크로 공유" />
          <MiniCard title="보안" value="권한 관리" sub="프로젝트별 접근 제어" />
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>사용자 후기</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {[
                { who: "운영팀", msg: "회의록 작성 시간이 1/3로 줄었어요." },
                { who: "PM", msg: "결정/할 일만 빠르게 확인할 수 있어 좋습니다." },
              ].map((x) => (
                <div key={x.msg} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 900, color: "#64748b" }}>{x.who}</div>
                  <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>{x.msg}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>문의</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={mockInput}>회사명</div>
              <div style={mockInput}>이메일</div>
              <div style={mockInput}>문의 내용</div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span
                  style={{
                    ...btn,
                    background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
                    borderColor: "transparent",
                    color: "#fff",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                  }}
                >
                  문의 보내기
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function PrototypeTemplateMockPreview({ template }: { readonly template: PrototypeTemplate }) {
  const desc = template.description?.trim();
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 16,
          background: "linear-gradient(110deg, rgba(254,243,199,0.55) 0%, rgba(250,232,255,0.75) 45%, rgba(224,231,255,0.55) 100%)",
          border: "1px solid rgba(167, 139, 250, 0.35)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 28px rgba(91, 33, 182, 0.08)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 15, fontWeight: 1000, color: "#4c1d95", letterSpacing: "-0.02em" }}>
            {template.nameKo}{" "}
            <span style={{ color: "#9333ea", fontWeight: 850, fontSize: 13 }}>({template.nameEn})</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill label="실제 결과물 예시" tone="good" />
            <Pill label="UI-only" tone="neutral" />
          </div>
        </div>
        {desc ? (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#5b21b6", lineHeight: 1.6, fontWeight: 750 }}>{desc}</div>
        ) : null}
      </div>

      {template.id === "meeting-workspace" ? (
        <MeetingWorkspaceMock />
      ) : template.id === "dashboard" ? (
        <DashboardMock />
      ) : template.id === "booking" ? (
        <BookingMock />
      ) : template.id === "marketplace" ? (
        <MarketplaceMock />
      ) : (
        <LandingMock />
      )}

      <div
        style={{
          fontSize: 11.5,
          color: "#5b21b6",
          fontWeight: 800,
          lineHeight: 1.55,
          padding: "12px 14px",
          borderRadius: 14,
          borderLeft: "4px solid #c026d3",
          background: "linear-gradient(90deg, rgba(250,245,255,0.95) 0%, rgba(255,255,255,0.6) 100%)",
          boxShadow: "0 2px 14px rgba(124, 58, 237, 0.08)",
        }}
      >
        이 화면은 템플릿의 “결과물 형태”를 빠르게 이해하기 위한 정적 미리보기입니다. 실제 생성 결과는 프로젝트 맥락에 따라 구성/문구/레이아웃이 달라질 수 있습니다.
      </div>
    </div>
  );
}

const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 22,
  minWidth: 42,
  padding: "0 8px",
  borderRadius: 999,
  border: "1px solid rgba(167, 139, 250, 0.4)",
  fontSize: 11.5,
  fontWeight: 950,
};

const panel: CSSProperties = {
  border: "1px solid rgba(167, 139, 250, 0.4)",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(250,245,255,0.92) 100%)",
  overflow: "hidden",
  boxShadow: "0 4px 22px rgba(91, 33, 182, 0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
};

const panelTitle: CSSProperties = { fontSize: 12.5, fontWeight: 1000, color: "#6d28d9", letterSpacing: "-0.01em" };

const subPanel: CSSProperties = {
  border: "1px solid rgba(167, 139, 250, 0.3)",
  borderRadius: 14,
  padding: 10,
  background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, #faf5ff 100%)",
};
const subTitle: CSSProperties = { fontSize: 12, fontWeight: 950, color: "#7c3aed" };

const btn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(167, 139, 250, 0.45)",
  background: "linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)",
  color: "#5b21b6",
  fontSize: 12.5,
  fontWeight: 950,
};

const tab: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(167, 139, 250, 0.35)",
  background: "linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)",
  color: "#5b21b6",
  fontSize: 12.5,
  fontWeight: 950,
};

const contentCard: CSSProperties = {
  border: "1px solid rgba(167, 139, 250, 0.35)",
  borderRadius: 14,
  padding: 12,
  background: "linear-gradient(145deg, #ffffff 0%, #faf5ff 55%, #fffbeb 100%)",
  boxShadow: "0 2px 12px rgba(124, 58, 237, 0.06)",
};
const contentTitle: CSSProperties = { fontSize: 12, fontWeight: 1000, color: "#7c3aed" };
const list: CSSProperties = { marginTop: 8, paddingLeft: 16, marginBottom: 0, color: "#4c1d95", fontWeight: 850, fontSize: 12.5, lineHeight: 1.55 };

const bubble: CSSProperties = {
  border: "1px solid rgba(167, 139, 250, 0.3)",
  borderRadius: 12,
  padding: 10,
  background: "linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)",
};
const bubbleWho: CSSProperties = { fontSize: 11.5, fontWeight: 950, color: "#9333ea", marginBottom: 6 };

const navItem: CSSProperties = {
  padding: "10px 10px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 950,
};

const mockInput: CSSProperties = {
  border: "1px solid rgba(167, 139, 250, 0.35)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)",
  color: "#a78bfa",
  fontSize: 12.5,
  fontWeight: 900,
};

const chipRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" };

