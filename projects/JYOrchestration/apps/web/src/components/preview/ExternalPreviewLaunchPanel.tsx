"use client";

import styles from "@/components/preview/completedCodeTaskPreviewPage.module.css";

export function ExternalPreviewLaunchPanel(props: {
  readonly externalPreviewUrl: string;
}) {
  const url = props.externalPreviewUrl.trim();
  return (
    <div className={styles.fallbackBody} data-testid="completed-codetask-external-preview-launch">
      <p className={styles.noticeOk}>GitHub Pages Preview는 새 창에서 확인합니다.</p>
      <p className={styles.summaryLine}>
        플랫폼 내부에서는 Preview 범위와 상태만 표시합니다. 외부 실행 URL은 iframe으로 표시하지
        않습니다.
      </p>
      <button
        type="button"
        className={styles.externalOpenButton}
        data-testid="completed-codetask-external-preview-open-button"
        onClick={() => {
          window.open(url, "_blank", "noopener,noreferrer");
        }}
      >
        새 창으로 열기
      </button>
    </div>
  );
}
