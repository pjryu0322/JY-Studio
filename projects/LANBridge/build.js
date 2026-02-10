#!/usr/bin/env node

/**
 * LANBridge Electron 앱 빌드 및 배포 스크립트
 * 
 * 사용법:
 * node build.js          # 현재 플랫폼용 빌드
 * node build.js win      # Windows 빌드
 * node build.js mac      # Mac 빌드
 * node build.js linux    # Linux 빌드
 * node build.js all      # 모든 플랫폼 빌드
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = process.argv[2] || process.platform;
const rootDir = __dirname;
const assetsDir = path.join(rootDir, 'assets');

console.log('╔═══════════════════════════════════╗');
console.log('║  LANBridge Electron Builder       ║');
console.log('╚═══════════════════════════════════╝\n');

// 1. assets 폴더 확인
if (!fs.existsSync(assetsDir)) {
  console.log('📁 assets 폴더 생성...');
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 2. 아이콘 확인
const iconFiles = {
  win: path.join(assetsDir, 'icon.ico'),
  mac: path.join(assetsDir, 'icon.icns'),
  linux: path.join(assetsDir, 'icon.png')
};

const missingIcons = Object.entries(iconFiles)
  .filter(([_, filePath]) => !fs.existsSync(filePath))
  .map(([platform, _]) => platform);

if (missingIcons.length > 0) {
  console.warn(`⚠️  아이콘 파일 누락 (${missingIcons.join(', ')})`);
  console.warn('   프로덕션 배포 전에 아이콘을 assets/ 폴더에 추가하세요.\n');
}

// 3. package.json 확인
const packageJson = require('./package.json');
console.log(`📦 앱 정보: ${packageJson.name} v${packageJson.version}`);
console.log(`🎯 빌드 대상: ${platform}\n`);

// 4. npm 의존성 확인
console.log('🔍 npm 의존성 확인...');
try {
  if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
    console.log('📥 npm install 실행 중...\n');
    execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
  }
} catch (err) {
  console.error('❌ npm install 실패:', err.message);
  process.exit(1);
}

// 5. 빌드 실행
console.log('\n🏗️  빌드 시작...\n');

const buildMap = {
  'win': 'npm run build:win',
  'windows': 'npm run build:win',
  'mac': 'npm run build:mac',
  'darwin': 'npm run build:mac',
  'linux': 'npm run build:linux',
  'all': 'npm run build:all'
};

const buildCmd = buildMap[platform];

if (!buildCmd) {
  console.error(`❌ 알 수 없는 플랫폼: ${platform}`);
  console.log('   사용 가능한 플랫폼: win, mac, linux, all');
  process.exit(1);
}

try {
  execSync(buildCmd, { cwd: rootDir, stdio: 'inherit' });
  console.log('\n✅ 빌드 완료!\n');
  console.log('📂 배포 파일 위치: ./dist/\n');
} catch (err) {
  console.error('\n❌ 빌드 실패:', err.message);
  process.exit(1);
}
