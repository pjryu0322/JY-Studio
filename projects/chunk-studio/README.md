# Chunk Studio

Chunk Studio는 문서 업로드부터 구조/미리보기/청크 검토, diff 확인, RAG-ready 내보내기까지 연결되는 **문서 청킹 워크벤치**입니다.  
역할 기반 진입 허브를 통해 Operator와 Manager가 각자 필요한 화면으로 빠르게 이동할 수 있습니다.

## Quick Start

```bash
cd projects/chunk-studio
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 주요 화면 구조

- `/` : **Entry Hub** (역할 선택, KPI, 최근 작업/문서/알림)
- `/workspace` : **Operator Dashboard** (업로드, 최근 작업 재개, 작업 진입)
- `/admin` : **Manager Dashboard** (작업 모니터링, 실패/알림, 템플릿 운영)
- `/jobs` : 최근 작업 목록 및 상세 진입
- `/jobs/[jobId]` : 작업 상세 워크벤치 (구조/미리보기/청크 리뷰)
- `/templates/builder` : 템플릿 빌더/추천/드리프트 점검

## 역할 모델

### Operator

- 문서 업로드
- 최근 작업 이어가기
- 구조/미리보기/청크 검토
- diff 확인 및 RAG-ready 결과 준비

### Manager

- 작업 파이프라인 모니터링
- 실패 작업 및 알림 점검
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

## 템플릿/드리프트 흐름

- 작업 상세에서 템플릿 추천/적용 가능
- `/templates/builder`에서 섹션/필드/표 기반 템플릿 편집 가능
- Drift 검사 결과는 `severity`/`score`로 제공
- Drift 결과 저장 경로: `data/drifts/<family>/<templateId>/<version>/<docId>.json`

## 참고

- 본 프로젝트는 단순 텍스트 데모가 아닌, **문서 중심의 시각적 청킹 워크벤치**를 목표로 합니다.
- 엔진 레이어(청킹/템플릿/잡 처리)는 UI 레이어와 분리되어 유지됩니다.
