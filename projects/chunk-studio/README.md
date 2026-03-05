# Chunk Studio

클라이언트에서 텍스트를 청크로 나누고, 작업(Job) 업로드·처리·대체 PDF 업로드를 지원하는 도구입니다.

## 실행 방법

```bash
cd projects/chunk-studio
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

- **메인**: 텍스트 입력 → 청킹 → JSON 내보내기 (Phase-1)
- **작업 목록** (`/jobs`): 파일 업로드, 작업 상태 확인, HWP 시 대체 PDF 업로드

### PostgreSQL + Worker 사용 시

1. `.env` 에 `DATABASE_URL` 설정 (예: `postgresql://user:pass@localhost:5432/chunk_studio`)
2. `npm run db:push` 로 스키마 반영
3. 별도 터미널에서 `npm run worker` 로 Worker 실행 (QUEUED 작업 처리)

## Phase-1 기능 (메인 화면)

- **파일 업로드**: `.txt` / `.md` → 입력 영역에 로드
- **자동 청킹**: 설정 가능한 **maxTokens**(50–2000), 단어 수 기반 토큰 근사
- **수동 조작**: Merge Next, Split, Delete
- **내보내기**: JSON 다운로드

## HWP/HWPX 처리 정책

- **자동 변환 미지원**: HWP/HWPX는 품질·호환성 이유로 서버에서 자동 변환하지 않습니다.
- **사용자 변환 후 업로드**: 한컴 오피스 등에서 PDF로 저장한 뒤, 해당 작업에 대해 **「PDF로 대체 업로드」** 로 업로드해 주세요.
- **작업 목록** (`/jobs`) 에서 상태가 **ACTION_REQUIRED** 인 작업에 「PDF로 대체 업로드」 버튼이 표시됩니다. 변환 방법은 페이지 내 접이식 안내를 참고하세요.
- 대체 PDF 업로드 후에는 해당 작업이 정상 파이프라인(QUEUED → CONVERTING → … → DONE)으로 진행됩니다.

## 실패한 작업

- 상태가 **FAILED** 인 작업에는 “실패한 작업은 PDF를 다시 업로드하거나 새 작업으로 등록해 주세요.” 안내가 표시됩니다.
- 새 파일을 **파일 업로드**로 올리거나, HWP 계열이었다면 PDF로 변환 후 **PDF로 대체 업로드**를 사용하면 됩니다.

## 알려진 제한

- **토큰 근사**: 단어 수 기반이며, 실제 모델 토큰화가 아닙니다.
- **OCR 없음**: 이미지/PDF 내 텍스트 추출은 지원하지 않습니다.
- **DB 미설정 시**: `DATABASE_URL` 이 없으면 작업 목록·업로드·대체는 메모리 목업으로 동작합니다.

## Template 기능 (MVP)

문서 업로드 후 `/jobs` 상세에서 템플릿 추천/적용, `/templates/builder` 에서 새 템플릿 생성이 가능합니다.

1. **추천**: `Template 추천` 패널에서 family 입력 후 추천 실행
2. **생성**: 추천이 없으면 `새 템플릿 만들기`로 이동
3. **Builder**: 좌측 문서 프리뷰에서 bbox 선택 → 섹션/필드/표 정의 → 저장
4. **적용**: 저장 직후 template-aware chunk preview 확인

### Template Builder UX 노트 (Quick Flow)

- Step 버튼을 누르지 않아도 bbox 드래그 후 Floating 메뉴(섹션/필드/표)로 즉시 생성됩니다.
- 필드 선택 시 추천 라벨 드롭다운(성명, 연락처, 주소, 부서, 직위, 입사일, 사직예정일, 사직사유, E-mail)을 제공합니다.
- 생성 즉시 우측 Template Tree에 반영되며, 기존 Step 데이터 구조와 동일 상태를 사용합니다.
- JSON 패널은 기본 숨김이며, 상단 `고급/디버그` 토글을 켰을 때만 표시됩니다.
- 선택 bbox는 builder store의 `pendingSelection`에 저장되어 Quick Flow와 추천 라벨 계산에 사용됩니다.

### 템플릿 저장 위치

- 스키마: `data/templates/<family>/<templateId>/<version>/template.json`
- 인덱스: `data/templates/<family>/index.json`

### 템플릿 API

- `GET /api/templates?family=...`
- `GET /api/templates/{templateId}?family=...&version=...`
- `POST /api/templates/recommend` `{ jobId, family }`
- `POST /api/templates/build` `{ family, name, docType, selections, profile }`
- `POST /api/templates/apply` `{ jobId, family, templateId, version }`

## Template Drift

### What is Template Drift

- 템플릿 구조(섹션/필드/표/반복/앵커)와 현재 문서 구조의 차이를 수치화한 점검 결과입니다.
- 결과는 `severity(low/medium/high)`와 `score(0~1)`로 제공됩니다.

### How it works

- 기준: 저장된 템플릿 스키마
- 비교 대상: 문서에서 auto-detect로 생성한 draft 구조
- 엔진이 차이 요약을 만들고 점수/등급을 계산합니다.

### UI에서 실행 방법

1. `/templates/builder?jobId=...&family=...` 진입
2. 템플릿을 로드하거나 저장해 `templateId/version`을 선택
3. 우측 `Drift` 탭에서 `드리프트 검사` 실행
4. severity/score/요약/항목 및 최근 기록 확인

### Auto UX 영향

- `원클릭 자동 적용` 전에 템플릿이 선택된 경우 Drift를 먼저 검사합니다.
- `severity=high` 또는 `score>=0.7`이면 자동 적용을 중단하고 Drift 탭 확인을 안내합니다.
- 디버그 ON일 때만 override가 가능합니다.

### Drift 결과 저장 위치

- 파일: `data/drifts/<family>/<templateId>/<version>/<docId>.json`
- 목록 API: `GET /api/templates/drift?family=...&templateId=...&version=...`
- 단건 API: `GET /api/templates/drift/{docId}?family=...&templateId=...&version=...`

### 수동 검증 시나리오

- **Case A**: 동일 템플릿 + 유사 문서 -> `low drift` 기대
- **Case B**: 섹션 추가 + 필드 제거 -> `medium drift` 기대
- **Case C**: 앵커 누락 + 표 헤더 변경 -> `high drift` 기대
