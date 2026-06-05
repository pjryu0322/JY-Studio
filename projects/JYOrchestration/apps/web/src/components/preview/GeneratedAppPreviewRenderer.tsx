"use client";

import { useMemo, useState } from "react";
import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import {
  buildGeneratedAppPreviewPanels,
  pickDefaultGeneratedAppPreviewPanelId,
  type GeneratedAppPreviewPanelId,
} from "@/lib/prototype/generatedAppPreviewLayout";
import styles from "@/components/preview/generatedAppPreviewRenderer.module.css";

export function GeneratedAppPreviewRenderer(props: {
  readonly projectId: string;
  readonly projectName?: string | null;
  readonly previewScope: ImplementationPreviewScopeV1;
}) {
  const panels = useMemo(() => buildGeneratedAppPreviewPanels(props.previewScope), [props.previewScope]);
  const defaultPanel = useMemo(() => pickDefaultGeneratedAppPreviewPanelId(panels), [panels]);
  const [activePanel, setActivePanel] = useState<GeneratedAppPreviewPanelId>(defaultPanel);

  const active = panels.find((p) => p.id === activePanel) ?? panels[0] ?? null;
  const includedCount = props.previewScope.includedCodeTasks.length;

  return (
    <div className={styles.root} data-testid="generated-app-preview-renderer">
      <header className={styles.appHeader}>
        <div className={styles.appTitle}>{props.projectName?.trim() || "생성 앱 Preview"}</div>
        <div className={styles.appSubtitle}>완료 CodeTask {includedCount}개 반영</div>
      </header>
      {panels.length > 1 ? (
        <nav className={styles.tabRow} aria-label="화면 전환">
          {panels.map((panel) => (
            <button
              key={`${panel.id}-${panel.codeTaskId}`}
              type="button"
              className={activePanel === panel.id ? styles.tabActive : styles.tab}
              onClick={() => setActivePanel(panel.id)}
            >
              {panel.title}
              {!panel.completed ? " · 미완료" : ""}
            </button>
          ))}
        </nav>
      ) : null}
      <main className={styles.stage}>
        {active?.completed ? (
          <GeneratedAppPreviewPanelBody panelId={active.id} title={active.title} scope={props.previewScope} />
        ) : (
          <div className={styles.placeholder}>
            <p className={styles.placeholderTitle}>{active?.title ?? "화면"}</p>
            <p>이 영역은 아직 완료된 CodeTask에 포함되지 않았습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function GeneratedAppPreviewPanelBody(props: {
  readonly panelId: GeneratedAppPreviewPanelId;
  readonly title: string;
  readonly scope: ImplementationPreviewScopeV1;
}) {
  if (props.panelId === "shell") {
    return (
      <div className={styles.shellFrame}>
        <div className={styles.shellTopBar}>App Shell</div>
        <div className={styles.shellBody}>
          <p>{props.title}</p>
          <p className={styles.muted}>네비게이션·레이아웃 프레임이 반영된 상태입니다.</p>
        </div>
      </div>
    );
  }
  if (props.panelId === "sample_data") {
    return (
      <div className={styles.sampleCard}>
        <h2>샘플 데이터</h2>
        <ul>
          <li>데모 사용자 · user-demo-001</li>
          <li>데모 항목 · item-alpha, item-beta</li>
          <li>상태 · draft / active</li>
        </ul>
      </div>
    );
  }
  if (props.panelId === "input") {
    return (
      <form className={styles.formCard} onSubmit={(e) => e.preventDefault()}>
        <h2>{props.title}</h2>
        <label className={styles.field}>
          <span>제목</span>
          <input type="text" placeholder="입력 예시" defaultValue="샘플 입력" readOnly />
        </label>
        <label className={styles.field}>
          <span>설명</span>
          <textarea placeholder="내용을 입력하세요" defaultValue="완료된 입력 화면 Preview" readOnly />
        </label>
        <button type="button" className={styles.primaryButton}>
          저장
        </button>
      </form>
    );
  }
  if (props.panelId === "result") {
    return (
      <div className={styles.resultCard}>
        <h2>{props.title}</h2>
        <p className={styles.resultOk}>처리 완료</p>
        <dl>
          <dt>요약</dt>
          <dd>완료된 CodeTask 기준 결과 화면 미리보기</dd>
          <dt>포함 CodeTask</dt>
          <dd>{props.scope.includedCodeTasks.length}개</dd>
        </dl>
      </div>
    );
  }
  return (
    <div className={styles.genericCard}>
      <h2>{props.title}</h2>
      <p>완료된 CodeTask 화면 미리보기</p>
    </div>
  );
}
