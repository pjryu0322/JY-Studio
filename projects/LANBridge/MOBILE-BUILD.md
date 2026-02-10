# 📱 LANBridge 모바일 앱 빌드 가이드 (Capacitor)

iOS와 Android에서 LANBridge를 네이티브 앱으로 배포하는 방법입니다.

## 🎯 개요

LANBridge는 이제 모든 플랫폼을 지원합니다:

| 플랫폼 | 파일 | 설치 |
|--------|------|------|
| **Windows** | `.exe` | 자동 설치 프로그램 |
| **Mac** | `.dmg` | 드래그 앤 드롭 |
| **Linux** | `.AppImage` | 더블클릭 실행 |
| **iOS** | `.ipa` | App Store 또는 TestFlight |
| **Android** | `.apk` | Google Play 또는 APK 설치 |

---

## 📋 요구사항

### 모든 플랫폼

- **Node.js v16+** ([다운로드](https://nodejs.org/))
- **npm** (Node.js와 함께 설치)

### iOS 빌드 (Mac 필수)

- **macOS** (10.12 이상)
- **Xcode** 12.0 이상
  ```bash
  # App Store에서 설치하거나
  xcode-select --install
  ```
- **Cocoapods**
  ```bash
  sudo gem install cocoapods
  ```

### Android 빌드

- **Android Studio** ([다운로드](https://developer.android.com/studio))
- **Java Development Kit (JDK)** 11 이상
- **Android SDK** (Android Studio에 포함)
- **Gradle** (Android Studio에 포함)

---

## 🚀 빠른 시작

### Step 1: 의존성 설치

```bash
cd LANBridge
npm install
```

첫 설치 시 Capacitor 플러그인 다운로드 (~100MB, 3-5분)

### Step 2: 모바일 환경 초기화

iOS와 Android 프로젝트 생성:

```bash
node mobile-build.js setup
```

결과:
```
LANBridge/
├── ios/                    ← iOS 프로젝트 (Xcode)
├── android/                ← Android 프로젝트 (Android Studio)
├── www/                    ← 웹 리소스 (자동 생성)
└── ...
```

### Step 3: iOS 빌드 (Mac)

```bash
node mobile-build.js ios
```

또는 직접:
```bash
npm run cap:ios
```

**결과:**
- Xcode 자동 열기
- iOS 시뮬레이터 또는 기기에서 테스트

### Step 4: Android 빌드

```bash
node mobile-build.js android
```

또는 직접:
```bash
npm run cap:android
```

**결과:**
- Android Studio 자동 열기
- Android 에뮬레이터 또는 기기에서 테스트

---

## 📱 iOS 앱 배포

### 개발/테스트 (TestFlight)

1. **개발 팀 설정**
   - Xcode 열기
   - 상단 메뉴 → Signing & Capabilities
   - Team 선택 (Apple Developer Account 필요)

2. **Build for Testing**
   ```
   Product → Build for Testing (⌘B)
   ```

3. **TestFlight 업로드**
   - Xcode → Organizer
   - Develop → Select Archive
   - Distribute App
   - TestFlight 선택

4. **테스터 초대**
   - App Store Connect 접속
   - TestFlight → Testers 추가

### 프로덕션 출시 (App Store)

1. **앱 정보 설정**
   - App Store Connect에서 앱 설명, 스크린샷, 카테고리 등 입력

2. **빌드 업로드**
   ```
   Product → Archive (⌘B)
   Organizer → Distribute App
   App Store 선택
   ```

3. **심사 제출**
   - App Store Connect에서 "Submit for Review" 클릭
   - Apple 심사 대기 (일반적으로 1-3일)

4. **출시**
   - 심사 통과 후 자동으로 App Store에 공개

---

## 🤖 Android 앱 배포

### 개발/테스트 (Firebase)

1. **Debug APK 빌드**
   ```bash
   # Android Studio에서
   Build → Build Bundle(s) / APK(s) → Build APK(s)
   ```

2. **기기에 설치**
   ```bash
   # 또는 USB 드라이브로 기기에 전달
   # 기기에서 직접 APK 클릭해서 설치
   ```

### 프로덕션 출시 (Google Play)

1. **Keystore 생성** (서명용)
   ```bash
   # Android Studio Terminal에서
   keytool -genkey -v -keystore ~/lanbridge.keystore \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias lanbridge
   ```

2. **Signing 설정**

   **android/app/build.gradle 수정:**
   ```gradle
   android {
     signingConfigs {
       release {
         storeFile file("../lanbridge.keystore")
         storePassword "your_password"
         keyAlias "lanbridge"
         keyPassword "your_password"
       }
     }
     buildTypes {
       release {
         signingConfig signingConfigs.release
       }
     }
   }
   ```

3. **Release APK/AAB 생성**
   ```
   Build → Build Bundle(s) / APK(s) → Build APK(s) (Release)
   ```

4. **Google Play Console 업로드**
   - Google Play Console 접속
   - 앱 생성
   - APK 또는 AAB 업로드
   - 앱 정보 입력 (설명, 스크린샷 등)
   - "Submit for Review"

5. **심사 대기**
   - 일반적으로 몇 시간 내 심사 완료
   - Play Store에서 자동 공개

---

## 🔄 코드 수정 후 동기화

웹 코드를 수정한 경우 모바일 앱에 반영:

```bash
# 모든 플랫폼에 동기화
node mobile-build.js sync

# 또는 개별적으로
npm run cap:sync
npx cap sync ios
npx cap sync android
```

---

## 🌐 WiFi 네트워크 접속

모바일과 PC가 같은 WiFi에 연결되어야 합니다.

### iOS에서 PC의 LANBridge 접속

1. PC에서 Launcher 시작 (실행 중인지 확인)
2. iOS 앱에서 LAN 주소 입력
   - 예: `http://192.168.0.100:3000`
3. "공유자"/"참여자" 역할 선택
4. P2P 연결 완료!

### Android에서 PC의 LANBridge 접속

1. PC에서 Launcher 시작 (실행 중인지 확인)
2. Android 앱에서 LAN 주소 입력
   - 예: `http://192.168.0.100:3000`
3. 네트워크 권한 허용
4. "공유자"/"참여자" 역할 선택
5. P2P 연결 완료!

---

## 🐛 문제 해결

### iOS 빌드 오류: "Code Sign Error"

```bash
# Signing 설정 재구성
rm -rf ios
npx cap add ios
npm run cap:ios
```

### Android 빌드 오류: "Gradle Sync Failed"

1. Android Studio → Tools → SDK Manager
2. SDK 업데이트 확인
3. 다시 빌드

### WiFi 연결 불가

1. iOS/Android 기기와 PC가 같은 WiFi 네트워크 확인
2. Firewall 확인 (포트 3000 허용)
3. PC와 모바일 기기가 ping 가능한지 확인
   ```bash
   # PC에서 (IP는 실제 주소로)
   ping 192.168.0.50   # 모바일 기기 IP
   ```

### CORS 오류

```
Access-Control-Allow-Origin header is missing
```

→ capacitor.config.json에서 `server.cleartext: true` 확인

---

## 📊 플랫폼별 배포 체크리스트

### iOS App Store

- [ ] Apple Developer Account 활성화
- [ ] 앱 Bundle ID 설정
- [ ] Certificates & Provisioning Profiles 생성
- [ ] TestFlight에서 테스트
- [ ] App Store Connect에서 앱 정보 입력
- [ ] Screenshots (2개 이상, 각 언어별)
- [ ] Privacy Policy URL 제공
- [ ] Support URL 제공
- [ ] Submit for Review

### Android Google Play

- [ ] Google Play Developer Account 활성화 ($25)
- [ ] Keystore 생성 및 보관
- [ ] Release APK/AAB 생성
- [ ] Play Console에서 앱 생성
- [ ] Privacy Policy URL 제공
- [ ] Content Rating 작성
- [ ] Screenshots (2개 이상) 업로드
- [ ] App Description 작성
- [ ] Package name 설정
- [ ] Initial rollout (예: 50% 기기 대상 테스트)
- [ ] Full rollout로 확대

---

## 🔐 앱 서명 및 보안

### iOS

```bash
# Development Certificate
# Xcode → Preferences → Accounts → Signing Certificates
```

### Android

**Keystore는 절대 공개하지 마세요!**

```bash
# Keystore 백업 (안전한 곳에 저장)
cp ~/lanbridge.keystore ~/backups/lanbridge.keystore.backup
```

---

## 🎨 아이콘 및 스플래시 스크린

### iOS

1. Xcode 열기: `npm run cap:ios`
2. 좌측 navigator → LANBridge
3. App Icon 설정

### Android

1. Android Studio 열기: `npm run cap:android`
2. res → mipmap → ic_launcher 이미지 교체

---

## 📈 다음 단계

1. **TestFlight/Internal Testing**: 베타 테스터 모집
2. **App Store/Play Store 출시**: 정식 배포
3. **모니터링**: Crashes, Analytics 추적
4. **Update**: 앱 업데이트 배포

---

## 📞 지원

모바일 앱 관련 문제:

1. 콘솔 로그 확인 (Xcode Debugger 또는 Android Logcat)
2. Capacitor 공식 문서: https://capacitorjs.com/
3. GitHub Issues: 문제 보고

---

**All platforms, one codebase! 🚀**
