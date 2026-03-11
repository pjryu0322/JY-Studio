# Chunk Studio

Chunk Studio는 **문서 청킹 리뷰 작업공간**입니다.  
핵심 흐름은 PDF 업로드 → 원문 PDF 미리보기 → 의미 기반 청크 검토/정제입니다.

## Quick Start

```bash
cd projects/chunk-studio
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 주요 화면 구조

- `/` : 역할 선택(Role Gate)
- `/workspace` : 문서 청킹 작업공간
- `/admin` : 관리자 운영 화면
- `/jobs` : 작업 목록
- `/jobs/[jobId]` : 특정 작업의 청킹 리뷰 화면
- `/templates/builder` : 템플릿 빌더

## 작업공간 기능

- PDF 업로드/재업로드
- 원문 PDF 미리보기(실패 시 컴팩트 오류 상태)
- PDF 오버레이 기반 의미 청크 선택/검토
- 청크 상세 검토 및 정제(병합/분할/제외/레이블/메모)

> 참고: `/workspace`는 **TopBar + PDF Viewer(Chunk Overlay) + Chunk Detail Panel** 구조로 동작합니다.
> RAG 내보내기는 메인 리뷰 패널에서 분리되어 별도 기능으로 다룹니다.

## 역할 모델

### Operator

- 문서 업로드
- 구조/미리보기/청크 검토
- 청크 정제

### Manager

- 작업 운영 모니터링
- 실패 작업 점검
- 템플릿 운영/추천/드리프트 검토

## 실행/운영 메모

### PostgreSQL + Worker 사용

1. `.env` 에 `DATABASE_URL` 설정
2. `npm run db:push`
3. 별도 터미널에서 `npm run worker`

### HWP/HWPX 처리 정책

- HWP/HWPX 자동 변환은 지원하지 않습니다.
- PDF로 변환 후 작업에 `PDF로 대체 업로드`를 사용하세요.
- `ACTION_REQUIRED` 작업은 대체 업로드 후 파이프라인 처리로 복귀합니다.

## 참고

- 청킹 엔진/잡 처리/API 스키마는 UI 레이어와 분리되어 유지됩니다.
