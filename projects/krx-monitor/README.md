# krx-monitor

개인용 KRX 모니터링 도구의 **Web 중심 MVP**를 위한 초기 스캐폴드 문서입니다.

## 목표
- 관심그룹/관심종목 관리
- 실시간(초기엔 Mock) 모니터 화면
- `lightweight-charts` 기반 차트 시각화
- 5초 단위 로테이션 뷰
- 로테이션 LOCK/PIN 기능

## 방향성
- 1차는 **Web 중심**으로 시작
- 외부 데이터 연동은 우선 **Mock 데이터**로 구현
- 생성 도구(Next/Nest 등) 실행 전, 구조/원칙 문서부터 고정

## 확장 계획 (후속 버전)
- 실제 브로커/거래 API 연동
- ETF/그래프/패시브 분석 기능 확장
- Web 이후 앱(모바일/데스크톱) 확장 검토

## 제안 기술 스택 (초안)
- Frontend: Next.js (App Router) + TypeScript
- Chart: `lightweight-charts`
- Backend(BFF/API): NestJS 또는 Next API Route (추후 결정)
- Data: 초기 Mock → 이후 실데이터 Adapter 교체
- Infra: Docker 기반 로컬 개발 환경(추후)

## 로드맵
1. 폴더 구조/문서 확정 (현재 단계)
2. 웹 앱 스캐폴딩 생성 (다음 단계)
3. Mock 기반 watchlist/monitor/chart/news/memo 화면 MVP
4. 로테이션 LOCK/PIN 동작 완성
5. 실데이터 Adapter 연동

## 실행 예정 스크립트 자리
> 아직 스캐폴딩 전 단계이므로 placeholder 입니다.

- `pnpm install` (예정)
- `pnpm dev` (예정)
- `pnpm test` (예정)
- `pnpm lint` (예정)
