"use client";

import {
  PROVIDER_SUBMIT_ADMIN_REVIEW_NOTICE,
  PROVIDER_SUBMIT_PROVIDER_TASKS_TITLE,
  PROVIDER_SUBMIT_ADMIN_TASKS_TITLE,
} from "@/lib/role-based-ux-copy";

const PROVIDER_TASKS = [
  "원천 문서 등록",
  "Knowledge Unit 후보 확인",
  "구조/품질 점검 실행",
  "검색 평가 케이스 생성",
  "검색 품질 평가 실행",
  "검수 요청 제출",
];

const ADMIN_TASKS = [
  "Chunk 품질 최종 확인",
  "공개 여부 승인",
  "카탈로그/API 노출 전환",
];

export function SubmitAdminReviewNotice() {
  return (
    <section className="rounded-2xl border border-store-border bg-slate-50 p-4 text-xs text-slate-800">
      <h3 className="text-sm font-bold text-slate-900">역할 안내</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-bold text-slate-900">{PROVIDER_SUBMIT_PROVIDER_TASKS_TITLE}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-store-muted">
            {PROVIDER_TASKS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-bold text-slate-900">{PROVIDER_SUBMIT_ADMIN_TASKS_TITLE}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-store-muted">
            {ADMIN_TASKS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 rounded-lg border border-store-border bg-white px-3 py-2 leading-relaxed text-slate-700">
        {PROVIDER_SUBMIT_ADMIN_REVIEW_NOTICE}
      </p>
    </section>
  );
}
