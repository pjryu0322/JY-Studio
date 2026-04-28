"use client";

import type { CSSProperties } from "react";
import type { PrototypeTemplate } from "@/lib/templates/prototypeTemplates";

function Pill({ label, tone }: { readonly label: string; readonly tone: "neutral" | "good" | "warn" | "info" }) {
  const style: CSSProperties =
    tone === "good"
      ? { ...pill, background: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857" }
      : tone === "warn"
        ? { ...pill, background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" }
        : tone === "info"
          ? { ...pill, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e40af" }
          : { ...pill, background: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" };
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
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
      <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 1000, color: "#0f172a" }}>{value}</div>
      {sub ? <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: "#64748b" }}>{sub}</div> : null}
    </div>
  );
}

function Frame({
  title,
  subtitle,
  children,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div style={{ border: "1px solid #cbd5e1", borderRadius: 16, background: "#fff", overflow: "hidden" }}>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #e2e8f0",
          background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444", border: "1px solid #fecaca" }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0b", border: "1px solid #fde68a" }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#22c55e", border: "1px solid #a7f3d0" }} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 1000, color: "#0f172a" }}>{title}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b" }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill label="정적 목업" tone="info" />
          <Pill label="샘플 데이터" tone="neutral" />
        </div>
      </div>
      <div style={{ padding: 12, background: "#f8fafc" }}>{children}</div>
    </div>
  );
}

function MeetingWorkspaceMock() {
  return (
    <Frame title="회의 분석 워크스페이스" subtitle="녹취 업로드 · 변환 · 회의록 초안 · 요약/스크립트">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 320px",
          gap: 12,
          alignItems: "stretch",
          minHeight: 420,
        }}
      >
        <div style={{ ...panel, background: "#ffffff" }}>
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
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 10,
                  background: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 950, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {x.name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 800, color: "#64748b" }}>{x.time}</div>
                </div>
                <Pill label={x.tone === "good" ? "완료" : x.tone === "warn" ? "변환 중" : "대기"} tone={x.tone === "good" ? "good" : x.tone === "warn" ? "warn" : "neutral"} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, ...subPanel }}>
            <div style={subTitle}>참여자</div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Pill label="김PM" tone="neutral" />
              <Pill label="이Dev" tone="neutral" />
              <Pill label="박Design" tone="neutral" />
              <Pill label="오Ops" tone="neutral" />
            </div>
          </div>

          <div style={{ marginTop: 12, ...subPanel }}>
            <div style={subTitle}>변환 상태</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={statusRow}>
                <span style={statusLabel}>STT 변환</span>
                <Pill label="진행중" tone="warn" />
              </div>
              <div style={statusRow}>
                <span style={statusLabel}>화자 분리</span>
                <Pill label="대기" tone="neutral" />
              </div>
              <div style={statusRow}>
                <span style={statusLabel}>회의록 초안</span>
                <Pill label="대기" tone="neutral" />
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...panel, background: "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={panelTitle}>작업 공간</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Pill label="선택됨: 4/18 고객 인터뷰" tone="info" />
            </div>
          </div>

          <div style={{ marginTop: 12, border: "1px dashed #cbd5e1", borderRadius: 14, padding: 12, background: "#f8fafc" }}>
            <div style={{ fontSize: 12.5, fontWeight: 1000, color: "#0f172a" }}>녹취파일 업로드</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: "#64748b", fontWeight: 800 }}>
              파일을 드래그하거나 클릭해서 업로드하세요. (예: wav, m4a)
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...btn, background: "#0f766e", color: "#fff", borderColor: "#0f766e" }}>업로드</span>
              <span style={btn}>샘플 파일 사용</span>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>AI 변환 진행</div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>
                  <span>STT 변환</span>
                  <span style={{ color: "#9a3412" }}>63%</span>
                </div>
                <div style={{ marginTop: 8, height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: "63%", height: "100%", background: "#f59e0b" }} />
                </div>
                <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 800, color: "#64748b" }}>화자 분리는 STT 완료 후 시작됩니다.</div>
              </div>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>회의록 초안 생성 타임라인</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {[
                  { t: "업로드 완료", d: "녹취파일 업로드", tone: "good" as const },
                  { t: "STT 변환", d: "텍스트 전사 진행 중", tone: "warn" as const },
                  { t: "화자 분리", d: "발언자 구분", tone: "neutral" as const },
                  { t: "초안 생성", d: "요약/결정/할 일 생성", tone: "neutral" as const },
                ].map((x) => (
                  <div key={x.t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        marginTop: 3,
                        background: x.tone === "good" ? "#22c55e" : x.tone === "warn" ? "#f59e0b" : "#e2e8f0",
                        border: `2px solid ${x.tone === "good" ? "#16a34a" : x.tone === "warn" ? "#d97706" : "#94a3b8"}`,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 950, color: "#0f172a" }}>{x.t}</div>
                      <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 800, color: "#64748b" }}>{x.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 12px", background: "#fff", color: "#94a3b8", fontWeight: 900, fontSize: 12.5 }}>
              질문을 입력해보세요… (예: 결정사항만 요약해줘)
            </div>
            <span style={{ ...btn, background: "#0f766e", color: "#fff", borderColor: "#0f766e" }}>전송</span>
          </div>
        </div>

        <div style={{ ...panel, background: "#ffffff" }}>
          <div style={panelTitle}>결과 패널</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ ...tab, background: "#0f766e", borderColor: "#0f766e", color: "#fff" }}>요약본</span>
            <span style={tab}>스크립트</span>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
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

            <div style={{ ...contentCard, background: "#f8fafc" }}>
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
              <div style={{ marginTop: 8, fontSize: 11.5, color: "#64748b", fontWeight: 800 }}>
                탭 전환 시 “요약본/스크립트” 내용을 전환하는 UX가 포함됩니다.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function DashboardMock() {
  return (
    <Frame title="운영 대시보드" subtitle="KPI · 최근 요청 · 상태 분포 · 활동">
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, minHeight: 420 }}>
        <div style={{ ...panel, background: "#0f172a", borderColor: "#0f172a" }}>
          <div style={{ fontSize: 12, fontWeight: 1000, color: "#e2e8f0" }}>내비게이션</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {["대시보드", "요청 관리", "사용자 관리", "통계", "설정"].map((x, i) => (
              <div
                key={x}
                style={{
                  padding: "10px 10px",
                  borderRadius: 12,
                  background: i === 0 ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "#e2e8f0",
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
                        background: selected ? "#0f766e" : disabled ? "#f1f5f9" : "#fff",
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
                    <span style={{ ...btn, background: "#0f766e", color: "#fff", borderColor: "#0f766e" }}>예약 확정</span>
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
              <span style={{ ...btn, background: "#0f766e", color: "#fff", borderColor: "#0f766e" }}>검색</span>
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
                  <span style={{ ...btn, background: "#0f766e", borderColor: "#0f766e", color: "#fff" }}>담기</span>
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
              <span style={{ ...btn, background: "#0f766e", borderColor: "#0f766e", color: "#fff" }}>가입</span>
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
                <span style={{ ...btn, background: "#0f766e", borderColor: "#0f766e", color: "#fff" }}>무료로 시작하기</span>
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
                <span style={{ ...btn, background: "#0f766e", borderColor: "#0f766e", color: "#fff" }}>문의 보내기</span>
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
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 13.5, fontWeight: 1000, color: "#0f172a" }}>
          {template.nameKo} <span style={{ color: "#64748b", fontWeight: 850 }}>({template.nameEn})</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill label="실제 결과물 예시" tone="good" />
          <Pill label="UI-only" tone="neutral" />
        </div>
      </div>
      {desc ? <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>{desc}</div> : null}

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

      <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 800, lineHeight: 1.55 }}>
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
  border: "1px solid #e2e8f0",
  fontSize: 11.5,
  fontWeight: 950,
};

const panel: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 12,
  background: "#fff",
  overflow: "hidden",
};

const panelTitle: CSSProperties = { fontSize: 12.5, fontWeight: 1000, color: "#64748b" };

const subPanel: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 14, padding: 10, background: "#f8fafc" };
const subTitle: CSSProperties = { fontSize: 12, fontWeight: 950, color: "#64748b" };

const statusRow: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" };
const statusLabel: CSSProperties = { fontSize: 12.5, fontWeight: 900, color: "#0f172a" };

const btn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 950,
};

const tab: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 950,
};

const contentCard: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" };
const contentTitle: CSSProperties = { fontSize: 12, fontWeight: 1000, color: "#64748b" };
const list: CSSProperties = { marginTop: 8, paddingLeft: 16, marginBottom: 0, color: "#0f172a", fontWeight: 850, fontSize: 12.5, lineHeight: 1.55 };

const bubble: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#fff" };
const bubbleWho: CSSProperties = { fontSize: 11.5, fontWeight: 950, color: "#64748b", marginBottom: 6 };

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
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#f8fafc",
  color: "#94a3b8",
  fontSize: 12.5,
  fontWeight: 900,
};

const chipRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" };

