# krx-monitor

KRX 모니터 개인용 MVP를 위한 **npm workspaces 기반 모노레포**입니다.

## 목표
- 관심그룹/관심종목 관리 + 모니터
- `lightweight-charts` 기반 차트
- 5초 로테이션 + LOCK/PIN
- 1차는 Web 중심, 외부 데이터는 Mock부터 시작
- 이후 확장: 실제 브로커 연동, ETF/그래프/패시브 분석(별도 버전)

## 구성
- `apps/api`: NestJS(TypeScript) API
- `apps/web`: Next.js(TypeScript) Web
- `packages/shared`: 공용 DTO/타입
- `apps/api/prisma`: Prisma schema/migrate/seed
- `docker-compose.yml`: Postgres

## API 요약
- Health: `GET /api/v1/health`
- 종목 검색: `GET /api/v1/stocks/search?q=`
- Watch CRUD:
  - `/api/v1/watch/sets`
  - `/api/v1/watch/sets/:setId/groups`
  - `/api/v1/watch/groups/:groupId/items`
  - `POST /api/v1/watch/groups/:groupId/items/bulk`
  - `POST /api/v1/watch/groups/:groupId/items/reorder`

## 로컬 실행 순서
1. 환경 변수 파일 생성
   - `cp .env.example .env`
2. 의존성 설치 (루트)
   - `npm install`
3. Postgres 실행
   - `npm run db:up`
4. Prisma Client 생성
   - `npm run prisma:generate`
5. 마이그레이션 실행
   - `npm run prisma:migrate`
6. 시드 데이터 입력 (stock_master 50개)
   - `npm run seed`
7. API + Web 동시 실행
   - `npm run dev`

## 핵심 동작 시나리오
1. `/watchlist/editor` 접속
2. 세트 생성 (예: `나의관심세트`)
3. 그룹 생성 (예: `단기모니터`)
4. 종목 검색 후 5개 추가
5. 아이템 ↑/↓ 버튼으로 정렬 순서 변경
6. 중요 종목 PIN 토글로 고정

## 주요 스크립트 (루트)
- `npm run dev`
- `npm run dev:api`
- `npm run dev:web`
- `npm run db:up`
- `npm run db:down`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run seed`
