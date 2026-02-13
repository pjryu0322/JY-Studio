# ARCHITECTURE

## 원칙
- 본 프로젝트의 1차 아키텍처는 **Web 중심**으로 설계한다.
- 도메인 로직은 UI/데이터소스와 분리해, 이후 앱 채널 확장을 쉽게 만든다.
- 외부 연동은 Adapter 계층으로 캡슐화하여 Mock ↔ 실데이터 전환 비용을 낮춘다.

## 레이어 개요 (MVP)
1. **Presentation (Web UI)**
   - Watchlist/Monitor/Chart/News/Memo 화면
   - 로테이션 제어(5초), LOCK/PIN 인터랙션
2. **Application (Use Cases)**
   - 종목 그룹 조회, 로테이션 규칙 적용, 상태 업데이트
3. **Domain (Entities/Rules)**
   - 그룹, 종목, 핀/락 상태, 메모, 뉴스 요약 등 핵심 모델
4. **Infrastructure (Adapters)**
   - MarketDataAdapter (초기 Mock 구현)
   - NewsAdapter (초기 Mock 구현)
   - PersistenceAdapter (브라우저 저장소/향후 DB)

## Adapter 구조 원칙
- 인터페이스 우선 정의 후 구현체를 바인딩한다.
- MVP에서는 Mock Adapter를 기본값으로 사용한다.
- 실데이터 연동 시 Adapter 구현체만 교체하도록 설계한다.
- UI는 Adapter 구체 타입을 직접 참조하지 않는다.

## 확장 전략
- 추후 모바일/데스크톱 앱이 추가되어도 Application/Domain을 재사용한다.
- 웹 전용 코드(라우팅, 브라우저 API)는 Presentation 레이어로 한정한다.
- 브로커 API, ETF/그래프/패시브 분석은 별도 버전에서 Adapter/UseCase 확장으로 흡수한다.
