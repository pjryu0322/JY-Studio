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

## 작업공간 기능

- PDF 업로드/재업로드
- 원문 PDF 미리보기 (실패 시 컴팩트 오류 상태)
- 페이지 단위 분석 (orientation / page type / confidence)
- 페이지 타입 수동 보정 (Analyzer에서 override)

> 참고: `/workspace`는 **Page Type Analyzer + PDF Viewer** 중심의 미니멀 편집 화면입니다.
> 템플릿 빌더/템플릿 드리프트 기능은 제거되었습니다.

## 역할 모델

### Operator

- 문서 업로드
- 페이지 분석 확인
- PDF 중심 리뷰

### Manager

- 작업 운영 모니터링
- 실패 작업 점검
- 운영 점검

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
