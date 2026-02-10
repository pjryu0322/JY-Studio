#!/usr/bin/env node

/**
 * LANBridge Capacitor 앱 빌드 및 배포
 * 
 * 사용법:
 * node mobile-build.js setup     # iOS/Android 환경 설정
 * node mobile-build.js ios       # iOS 빌드
 * node mobile-build.js android   # Android 빌드
 * node mobile-build.js sync      # 코드 동기화
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const platform = process.argv[2] || 'help';
const rootDir = __dirname;

console.log('╔═══════════════════════════════════╗');
console.log('║  LANBridge Mobile Builder         ║');
console.log('║  Powered by Capacitor             ║');
console.log('╚═══════════════════════════════════╝\n');

// 1. 필수 도구 확인
const checkDependencies = () => {
  console.log('🔍 필수 도구 확인...\n');

  const tools = [
    { name: 'node', cmd: 'node --version' },
    { name: 'npm', cmd: 'npm --version' }
  ];

  if (process.platform !== 'win32') {
    if (process.platform === 'darwin') {
      tools.push({ name: 'Xcode', cmd: 'xcode-select -p' });
    }
  }

  let allOk = true;
  tools.forEach(({ name, cmd }) => {
    try {
      const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
      console.log(`✅ ${name}: ${output.trim()}`);
    } catch (err) {
      console.log(`❌ ${name}: 설치 필요`);
      allOk = false;
    }
  });

  return allOk;
};

// 2. Capacitor 초기화
const setupCapacitor = () => {
  console.log('\n🔧 Capacitor 초기화...\n');

  try {
    // Capacitor CLI 확인
    execSync('npx cap --version', { stdio: 'inherit' });

    // iOS 프로젝트 추가
    console.log('\n📱 iOS 프로젝트 생성...');
    execSync('npx cap add ios', { cwd: rootDir, stdio: 'inherit' });

    // Android 프로젝트 추가
    console.log('\n🤖 Android 프로젝트 생성...');
    execSync('npx cap add android', { cwd: rootDir, stdio: 'inherit' });

    console.log('\n✅ Capacitor 초기화 완료!\n');

    console.log('📋 다음 단계:\n');
    console.log('iOS 빌드:');
    console.log('  npm run build:ios\n');
    console.log('Android 빌드:');
    console.log('  npm run build:android\n');

  } catch (err) {
    console.error('❌ Capacitor 초기화 실패:', err.message);
    process.exit(1);
  }
};

// 3. iOS 빌드
const buildIos = () => {
  console.log('\n📱 iOS 빌드 시작...\n');

  if (!fs.existsSync(path.join(rootDir, 'ios'))) {
    console.error('❌ iOS 프로젝트가 없습니다. 먼저 setup을 실행하세요.');
    console.log('  node mobile-build.js setup');
    process.exit(1);
  }

  try {
    console.log('📝 코드 동기화...');
    execSync('npx cap sync ios', { cwd: rootDir, stdio: 'inherit' });

    console.log('\n🏗️  Xcode 열기...');
    execSync('npx cap open ios', { cwd: rootDir, stdio: 'inherit' });

    console.log('\n✅ iOS 빌드 준비 완료!\n');
    console.log('📋 Xcode에서 다음을 수행하세요:');
    console.log('1. Product → Build (⌘B) 또는 Run (⌘R)');
    console.log('2. 시뮬레이터 또는 기기에서 앱 실행');
    console.log('3. 테스트 및 배포\n');

  } catch (err) {
    console.error('❌ iOS 빌드 실패:', err.message);
    process.exit(1);
  }
};

// 4. Android 빌드
const buildAndroid = () => {
  console.log('\n🤖 Android 빌드 시작...\n');

  if (!fs.existsSync(path.join(rootDir, 'android'))) {
    console.error('❌ Android 프로젝트가 없습니다. 먼저 setup을 실행하세요.');
    console.log('  node mobile-build.js setup');
    process.exit(1);
  }

  try {
    console.log('📝 코드 동기화...');
    execSync('npx cap sync android', { cwd: rootDir, stdio: 'inherit' });

    console.log('\n🏗️  Android Studio 열기...');
    execSync('npx cap open android', { cwd: rootDir, stdio: 'inherit' });

    console.log('\n✅ Android 빌드 준비 완료!\n');
    console.log('📋 Android Studio에서 다음을 수행하세요:');
    console.log('1. Build → Make Project (또는 Rebuild Project)');
    console.log('2. Run → Run (Shift+F10)');
    console.log('3. 에뮬레이터 또는 기기 선택');
    console.log('4. 테스트 및 배포\n');

  } catch (err) {
    console.error('❌ Android 빌드 실패:', err.message);
    process.exit(1);
  }
};

// 5. 코드 동기화
const syncAll = () => {
  console.log('\n🔄 코드 동기화...\n');

  try {
    if (fs.existsSync(path.join(rootDir, 'ios'))) {
      console.log('📱 iOS 동기화...');
      execSync('npx cap sync ios', { cwd: rootDir, stdio: 'inherit' });
    }

    if (fs.existsSync(path.join(rootDir, 'android'))) {
      console.log('🤖 Android 동기화...');
      execSync('npx cap sync android', { cwd: rootDir, stdio: 'inherit' });
    }

    console.log('\n✅ 동기화 완료!\n');
  } catch (err) {
    console.error('❌ 동기화 실패:', err.message);
    process.exit(1);
  }
};

// 메인 로직
const main = () => {
  switch (platform) {
    case 'help':
      console.log('사용법:\n');
      console.log('  node mobile-build.js setup     # iOS/Android 환경 설정');
      console.log('  node mobile-build.js ios       # iOS 빌드');
      console.log('  node mobile-build.js android   # Android 빌드');
      console.log('  node mobile-build.js sync      # 코드 동기화\n');
      break;

    case 'setup':
      if (checkDependencies()) {
        setupCapacitor();
      } else {
        console.error('\n❌ 필수 도구가 부족합니다.\n');
        console.log('설치 방법:');
        console.log('- Node.js: https://nodejs.org/');
        console.log('- Xcode (Mac): App Store에서 설치');
        console.log('- Android Studio: https://developer.android.com/studio\n');
      }
      break;

    case 'ios':
      buildIos();
      break;

    case 'android':
      buildAndroid();
      break;

    case 'sync':
      syncAll();
      break;

    default:
      console.error(`❌ 알 수 없는 명령어: ${platform}`);
      console.log('사용 가능한 명령어: setup, ios, android, sync');
      process.exit(1);
  }
};

main();
