# JYKStore

JYKStore는 **모바일 앱스토어형 지식팩 스토어**입니다. 관리자형 지식관리 UI가 아니라, 사용자가 지식팩을 발견·상세 확인·내 라이브러리에 추가·연동(API Key, Pack ID, 예시 코드)하는 흐름을 목표로 합니다.

## 독립 서비스 원칙

- JYKStore는 **JY-Studio 모노레포 안의 별도 프로젝트**이지만, **JYOrchestration 및 기타 프로젝트와 코드·DB·인증·환경변수를 공유하지 않습니다.**
- JYKStore 작업 시 **`projects/JYKStore` 이외 경로는 수정하지 않습니다.**

## 실행 방법

```bash
cd projects/JYKStore
npm install
npm run dev
```

브라우저: [http://localhost:3004](http://localhost:3004)

| Script  | 설명              |
|---------|-------------------|
| `dev`   | 개발 서버 (포트 **3004**) |
| `build` | 프로덕션 빌드     |
| `start` | 프로덕션 서버 (포트 **3004**) |
| `lint`  | ESLint            |

환경 변수 예시는 [`.env.example`](./.env.example)를 참고하세요.

## 초기 UX

- **투데이** 홈: 추천·빠른 연동·인기·신규·카테고리별 섹션
- 하단 탭: 투데이 / 검색 / 카테고리 / 내 지식팩 / 계정
- 375px 모바일 폭 기준, 데스크톱에서는 중앙 모바일 컨테이너 레이아웃

Mock 데이터: `src/data/mock-packs.ts` (간편인증 연동 지식팩 등)

## 향후 단계

1. 지식팩 상세
2. 내 지식팩 추가 (영구 저장)
3. API Key 발급
4. Context API
5. Provider / Admin 분리

## 기술 스택

Next.js (App Router), TypeScript, Tailwind CSS, ESLint, `src/` 디렉터리, import alias `@/*`
