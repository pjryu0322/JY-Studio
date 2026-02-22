# LANBridge

## Overview

로컬 네트워크에서 WebRTC 기반으로 채팅/파일 공유를 수행하는 Electron 앱입니다.

## Prerequisites

- Node.js (LTS 권장)
- npm

## Local run

```bash
npm install
npm run dev
```

- 일반 실행: `npm start`
- 웹 확인용(정적): `npm run web`

## Build

```bash
npm run build
```

- 플랫폼별: `npm run build:win`, `npm run build:mac`, `npm run build:linux`

## Test

```bash
npm run test
npm run lint
npm run format
```

---

## 프로젝트 구조 요약

```text
projects/LANBridge/
├─ main.js / preload.js          # Electron 메인/프리로드
├─ launcher.js / launcher.html   # 로컬 런처 UI (서버 시작 보조)
├─ signal-server.js              # 시그널링 서버
├─ app.js / webrtc.js / protocol.js
├─ index.html / style.css        # 앱 UI
├─ package.json                  # 스크립트/의존성
└─ README.md
```

## 참고

- HTTPS 로컬 인증서가 필요하면 `npm run cert:generate`를 사용하세요.
- 빌드 산출물/로컬 인증서/압축 파일은 Git 추적 대상에서 제외합니다.
