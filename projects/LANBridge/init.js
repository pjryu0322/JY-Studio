#!/usr/bin/env node

/**
 * LANBridge Electron 프로젝트 초기화 및 설정 확인
 */

const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const requiredFiles = [
  'main.js',
  'preload.js',
  'launcher.js',
  'signal-server.js',
  'app.js',
  'webrtc.js',
  'protocol.js',
  'index.html',
  'launcher.html',
  'style.css',
  'package.json'
];

const requiredDirs = [
  'assets',
  'docs'
];

console.log('╔════════════════════════════════════════╗');
console.log('║  LANBridge Electron 초기화 검사       ║');
console.log('╚════════════════════════════════════════╝\n');

// 파일 확인
console.log('📋 파일 구조 확인...\n');

let allFilesOk = true;
requiredFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} (누락)`);
    allFilesOk = false;
  }
});

console.log('\n📁 디렉토리 확인...\n');

let allDirsOk = true;
requiredDirs.forEach(dir => {
  const dirPath = path.join(rootDir, dir);
  if (fs.existsSync(dirPath)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`⚠️  ${dir}/ (자동 생성)`);
    fs.mkdirSync(dirPath, { recursive: true });
    allDirsOk = false;
  }
});

// package.json 확인
console.log('\n📦 package.json 확인...\n');

const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = require(packageJsonPath);

const requiredDeps = ['electron', 'electron-builder'];
const hasDeps = (packageJson.devDependencies || packageJson.dependencies);

let allDepsOk = true;
requiredDeps.forEach(dep => {
  if (hasDeps[dep]) {
    console.log(`✅ ${dep}: ${hasDeps[dep]}`);
  } else {
    console.log(`❌ ${dep} (누락)`);
    allDepsOk = false;
  }
});

// main.js 확인
console.log('\n⚙️  main.js 진입점 확인...\n');

const mainJs = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf-8');
const mainJsOk = mainJs.includes('app.on');
console.log(mainJsOk ? '✅ main.js가 올바른 Electron 구조를 가짐' : '❌ main.js 구조 오류');

// 아이콘 확인
console.log('\n🎨 아이콘 파일 확인...\n');

const iconFiles = {
  'icon.ico': 'Windows',
  'icon.icns': 'Mac',
  'icon.png': 'Linux'
};

const assetsDir = path.join(rootDir, 'assets');
let hasIcons = false;

Object.entries(iconFiles).forEach(([file, platform]) => {
  const filePath = path.join(assetsDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} (${platform})`);
    hasIcons = true;
  } else {
    console.log(`⚠️  ${file} (${platform}) - 프로덕션 배포 전에 추가 필요`);
  }
});

// 최종 결과
console.log('\n╔════════════════════════════════════════╗');

if (allFilesOk && allDepsOk && mainJsOk) {
  console.log('║  ✅ 모든 설정이 완료되었습니다!         ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log('🚀 다음 단계:\n');
  console.log('1️⃣  npm install (첫 설치만)\n');
  console.log('2️⃣  npm start (개발 모드)\n');
  console.log('3️⃣  npm run build:win (Windows 빌드)\n');
  
  if (!hasIcons) {
    console.log('💡 팁: assets/ 폴더에 아이콘을 추가하면 더 전문적인 앱이 됩니다.');
    console.log('   (ELECTRON-BUILD.md 참고)\n');
  }

  process.exit(0);
} else {
  console.log('║  ⚠️  몇 가지 문제가 있습니다         ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  if (!allDepsOk) {
    console.log('📥 npm 의존성 설치:\n');
    console.log('   npm install\n');
  }

  process.exit(1);
}
