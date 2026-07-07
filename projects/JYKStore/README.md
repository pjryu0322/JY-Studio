# JYKStore

JYKStore는 AI가 활용할 수 있는 제품·솔루션·API 연동 지식을 지식팩 형태로 제공하는 앱스토어형 지식팩 스토어입니다.

## 실행

```bash
npm install
npm run dev
```

접속:

```text
http://localhost:3004
```

## 핵심 원칙

- JYKStore는 독립 서비스입니다.
- JYKStore 이외 프로젝트를 수정하지 않습니다.
- 실행 포트는 3004입니다.
- UX는 모바일 앱스토어형 지식팩 스토어를 기준으로 합니다.
- 사용자는 지식팩 선택 → 내 지식팩에 추가 → 연동하기 흐름으로 사용할 수 있어야 합니다.

## 현재 구현 범위

- 모바일 앱스토어형 Today 화면
- 검색 진입 화면
- 카테고리 화면
- 내 지식팩 Empty State
- 계정 화면 Scaffold
- Mock 지식팩 데이터

## Phase 2 구현 범위

- 전체 지식팩 목록
- 지식팩 상세 화면
- 카테고리별 지식팩 목록
- Mock 데이터 기반 검색
- 앱스토어형 지식팩 상세 UX

## 아직 구현하지 않은 기능

- 내 지식팩 실제 추가 저장
- API Key 발급
- Context API
- DB 연동
- Provider/Admin 실제 기능

## 다음 단계

1. 내 지식팩 추가
2. 연동하기 화면
3. API Key 발급
4. Context API Mock
5. Provider/Admin 분리
