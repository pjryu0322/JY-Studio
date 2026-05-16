# JYGallery

JYGallery는 JYOrchestration에서 생성·고도화된 프로젝트를 공개 가능한 형태로 전시하고, 시장 반응 수집, 컨테스트, 유튜브 확산, 상업화 지원으로 연결하는 외부 성장 루프 프로젝트입니다.

## 역할 분리

```text
JYOrchestration: 프로젝트를 만든다
JY갤러리 공개 준비: 공개용으로 정리한다
JYGallery: 보여준다
JYContest: 평가한다
JY YouTube: 확산한다
JY Startup Support: 상업화로 연결한다
```

JYGallery는 일반 게시판이나 포트폴리오가 아니라, 플랫폼에서 생성된 프로젝트의 공개 시장이자 성장 채널입니다.

## 초기 폴더 구조

```text
projects/JYGallery/
├─ apps/
│  └─ web/                         # JYGallery 웹 프론트엔드
│     ├─ public/                    # 정적 리소스, 썸네일 샘플
│     └─ src/
│        ├─ app/                    # 라우팅/페이지 진입점
│        ├─ components/             # 공통 UI 컴포넌트
│        ├─ features/               # 도메인 기능 단위
│        │  ├─ gallery/             # 전체 갤러리
│        │  ├─ project-detail/      # 프로젝트 상세
│        │  ├─ user-channel/        # 사용자별 갤러리
│        │  ├─ contest/             # 컨테스트 갤러리
│        │  ├─ awards/              # 수상작/추천작
│        │  └─ publish-preview/     # JYOrchestration 공개 준비 미리보기 연계
│        ├─ lib/                    # 공통 유틸/API 클라이언트
│        ├─ styles/                 # 전역 스타일
│        └─ types/                  # 프론트엔드 타입
├─ packages/
│  ├─ gallery-core/                 # 공개 프로젝트 메타데이터/상태/도메인 모델
│  ├─ gallery-policy/               # 공개 전 점검, 개인정보/저작권/보안 정책
│  └─ gallery-contracts/            # JYOrchestration 연계 데이터 계약
├─ data/
│  ├─ samples/                      # 샘플 공개 프로젝트 데이터
│  └─ fixtures/                     # 화면/테스트용 고정 데이터
├─ docs/
│  ├─ architecture/                 # 서비스 구조/연계 구조
│  ├─ product/                      # MVP 범위, 화면 정책, UX 기준
│  ├─ contest/                      # 컨테스트 운영/평가 기준
│  ├─ policies/                     # 공개/철회/민감정보/저작권 정책
│  └─ youtube/                      # 유튜브 연계 콘텐츠 기획
├─ scripts/                         # 데이터 검증/샘플 생성/마이그레이션 보조 스크립트
└─ tests/                           # 도메인/정책/화면 테스트
```

## MVP 기준

1차 MVP는 다음 범위에 집중합니다.

- 공개 프로젝트 목록
- 프로젝트 상세 페이지
- 사용자별 갤러리 페이지
- 카테고리/태그 필터
- 조회수
- 좋아요
- 컨테스트 참여 표시
- 수상작 표시
- 유튜브 링크 연결

## 공개 데이터 원칙

작업용 프로젝트 원본 데이터와 JYGallery 공개용 메타데이터는 분리합니다. JYGallery에는 사용자가 공개에 동의한 프로젝트의 공개용 정보만 노출합니다.

초기 MVP 필수 공개 정보는 다음 7개입니다.

1. 프로젝트명
2. 한 줄 소개
3. 상세 소개
4. 카테고리
5. 태그
6. 대표 이미지
7. 공개 범위
