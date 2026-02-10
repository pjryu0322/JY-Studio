# 🚀 LANBridge 전체 플랫폼 통합 가이드

**모든 플랫폼에서 하나의 코드로 배포 가능한 LANBridge입니다!**

```
┌─────────────────────────────────────────┐
│   HTML/CSS/JavaScript (공유 코드베이스)  │
│  index.html, app.js, webrtc.js ...     │
└─────────────────────────────────────────┘
              ↓
   ┌──────────┴──────────┬─────────┐
   ↓                     ↓         ↓
Electron          Capacitor    Web
   ↓                     ↓         ↓
┌─────────────┐  ┌──────────────┐ ┌─────┐
│Windows      │  │iOS / Android │ │Web  │
│Mac          │  │              │ │     │
│Linux        │  └──────────────┘ └─────┘
└─────────────┘
```

---

## 📊 플랫폼별 배포 현황

| 플랫폼 | 상태 | 배포 방법 | 명령어 |
|--------|------|---------|-------|
| **Windows** | ✅ 완료 | `.exe` 설치프로그램 | `npm run build:win` |
| **Mac** | ✅ 완료 | `.dmg` 설치 이미지 | `npm run build:mac` |
| **Linux** | ✅ 완료 | `.AppImage` 휴대용 | `npm run build:linux` |
| **iOS** | ✅ 준비됨 | App Store / TestFlight | `node mobile-build.js ios` |
| **Android** | ✅ 준비됨 | Google Play / APK | `node mobile-build.js android` |

---

## 🎯 전체 설치 및 배포 절차

### Phase 1: 개발 환경 구성 (지금 여기)

```bash
# 1. 의존성 설치
npm install

# 2. 초기화 검사
node init.js

# 3. 개발 서버 시작
npm start    # Electron
```

### Phase 2: 데스크톱 배포 완료 ✅

```bash
# Windows
npm run build:win
# → dist/LANBridge-Setup-1.0.0.exe

# Mac
npm run build:mac
# → dist/LANBridge-1.0.0.dmg

# Linux
npm run build:linux
# → dist/LANBridge-1.0.0.AppImage
```

### Phase 3: 모바일 배포 준비 (지금 시작)

```bash
# Step 1: Capacitor 초기화
node mobile-build.js setup

# Step 2: iOS 빌드
node mobile-build.js ios

# Step 3: Android 빌드
node mobile-build.js android
```

---

## 📱 모바일 환경 요구사항

### iOS (Mac 필수)

1. **Xcode 12.0 이상**
   ```bash
   # App Store에서 설치 또는
   xcode-select --install
   ```

2. **Cocoapods**
   ```bash
   sudo gem install cocoapods
   ```

3. **Apple Developer Account** (배포 시 필요)
   - $99/년 (App Store 등록)

### Android

1. **Android Studio** ([다운로드](https://developer.android.com/studio))

2. **JDK 11+**
   ```bash
   # Android Studio에서 자동 설치 또는
   # https://www.oracle.com/java/technologies/downloads/
   ```

3. **Google Play Developer Account** (배포 시 필요)
   - $25 (일회성)

---

## 🔧 빠른 참고 CLI 명령어

### Electron (데스크톱)

```bash
npm start              # 개발 모드
npm run dev            # 개발자 도구 활성화
npm run build:all      # 모든 플랫폼 빌드
npm run build:win      # Windows만
npm run build:mac      # Mac만
npm run build:linux    # Linux만
```

### Capacitor (모바일)

```bash
npm run web                    # 웹 개발 서버
node mobile-build.js setup     # iOS/Android 생성
node mobile-build.js ios       # iOS Xcode 열기
node mobile-build.js android   # Android Studio 열기
node mobile-build.js sync      # 코드 동기화
npm run cap:sync               # 모든 플랫폼 동기화
```

---

## 📝 체계별 배포 체크리스트

### 📦 Windows 배포 체크리스트

- [ ] `npm run build:win` 빌드 성공
- [ ] `dist/LANBridge-Setup-*.exe` 테스트 설치
- [ ] 바탕화면 단축아이콘 생성됨
- [ ] 앱 시작 후 "서버 시작" 버튼 동작
- [ ] LAN 주소 표시됨
- [ ] 다른 PC에서 LAN 주소로 접속 가능
- [ ] 제어판에서 "프로그램 추가/제거" 가능

### 🍎 iOS 배포 체크리스트

- [ ] Mac에서 구성 가능 (Xcode, Cocoapods)
- [ ] `node mobile-build.js ios` 완료
- [ ] Xcode에서 앱 컴파일 성공
- [ ] 시뮬레이터에서 실행 테스트
- [ ] WiFi 주소 입력 후 P2P 연결 가능
- [ ] Apple Developer Account 활성화 (배포 시)
- [ ] TestFlight 베타 배포 완료 (선택사항)
- [ ] App Store 출시 준비 (정식)

### 🤖 Android 배포 체크리스트

- [ ] Android Studio 설치 완료
- [ ] JDK 11+ 설치 완료
- [ ] `node mobile-build.js android` 완료
- [ ] Android Studio에서 빌드 성공
- [ ] 에뮬레이터 또는 기기에서 실행 테스트
- [ ] WiFi 주소 입력 후 P2P 연결 가능
- [ ] Google Play Developer Account 활성화 (배포 시)
- [ ] Release AAB/APK 서명 완료 (정식)
- [ ] Google Play에 업로드 완료 (배포 시)

---

## 🌍 배포 우선순위 제안

### Week 1-2: Windows 배포 (이미 완료)
- ✅ `npm run build:win` 테스트
- ✅ 내부 사용자들에게 배포
- ✅ 피드백 수집

### Week 3-4: Android 배포
- 🔄 `node mobile-build.js android` 설정
- 🔄 Google Play Developer Account 활성화
- 🔄 Release APK 빌드 및 서명
- 🔄 테스터 모집 (Google Play Internal Testing)

### Week 5-6: iOS 배포
- 🔄 Mac에서 `node mobile-build.js ios` 설정
- 🔄 Apple Developer Account 활성화
- 🔄 TestFlight 베타 배포
- 🔄 App Store 심사 신청

### Week 7+: 지속적 개선
- 🔄 사용자 피드백 반영
- 🔄 버그 수정 및 성능 개선
- 🔄 App Store/Play Store에 업데이트 출시

---

## 💡 핵심 팁

### 1. 코드 한 번 작성, 모든 플랫폼에 배포

```
src/ (공유 폴더)
├── index.html      ← 모든 플랫폼 사용
├── app.js          ← 모든 플랫폼 사용
├── webrtc.js       ← 모든 플랫폼 사용
└── style.css       ← 모든 플랫폼 사용

Electron, Capacitor, Web 모두 같은 코드 사용!
```

### 2. 플랫폼별 최적화 (선택사항)

```javascript
// launcher.html에서 플랫폼 감지
const platform = window.Capacitor ? 'capacitor' : 
                 window.electronAPI ? 'electron' : 'web';

// 플랫폼별 다르게 처리
if (platform === 'capacitor') {
  // iOS/Android 전용 코드
}
```

### 3. 버전 관리 단순화

```json
// package.json에서 모든 플랫폼이 같은 버전 사용
{
  "version": "1.0.0"  // Windows/Mac/Linux/iOS/Android 모두 1.0.0
}
```

---

## 📚 상세 가이드

- **[GETTING-STARTED-ELECTRON.md](GETTING-STARTED-ELECTRON.md)** - Electron 데스크톱 앱 빌드
- **[ELECTRON-BUILD.md](ELECTRON-BUILD.md)** - Electron 상세 설정
- **[MOBILE-BUILD.md](MOBILE-BUILD.md)** - Capacitor 모바일 앱 빌드
- **[README.md](README.md)** - 사용 설명서
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - 배포 가이드

---

## 🎯 목표

✅ **Windows/Mac/Linux**: 데스크톱 앱 → **준비 완료**  
🔄 **iOS/Android**: 모바일 앱 → **설정 중**  

---

## 🚀 다음 단계

**지금 바로 시작하기:**

```bash
# 1. 현재 상태 확인
node init.js

# 2. 모바일 환경 초기화
node mobile-build.js setup

# 3. iOS 빌드 (Mac 필수)
node mobile-build.js ios

# 또는 Android 빌드
node mobile-build.js android
```

---

## ✨ 최종 목표

```
LANBridge 1.0.0

✅ Windows Desktop App
✅ Mac Desktop App  
✅ Linux Desktop App
✅ iOS Mobile App
✅ Android Mobile App

모든 플랫폼 하나의 코드로 관리 & 배포 가능!
```

---

**Happy Coding! 🎉**

Questions? Check the [MOBILE-BUILD.md](MOBILE-BUILD.md) for detailed instructions.
