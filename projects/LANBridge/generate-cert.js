#!/usr/bin/env node

/**
 * LANBridge 자체 서명 인증서 생성 (OpenSSL 불필요)
 * Node.js crypto 모듈 사용
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CERT_DIR = path.join(__dirname, 'certs');
const CERT_PATH = path.join(CERT_DIR, 'server.crt');
const KEY_PATH = path.join(CERT_DIR, 'server.key');

// LAN IP 찾기
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// OpenSSL 사용 가능 확인
function isOpenSSLAvailable() {
  try {
    execSync('openssl version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// OpenSSL로 인증서 생성
function generateWithOpenSSL(lanIP) {
  console.log('[Cert] OpenSSL을 사용하여 인증서 생성 중...');
  
  // 개인키 생성
  execSync(`openssl genrsa -out "${KEY_PATH}" 2048`, { stdio: 'inherit' });
  
  // 인증서 생성
  const subj = `/C=KR/ST=Seoul/L=Seoul/O=LANBridge/CN=${lanIP}`;
  const san = `subjectAltName=IP:${lanIP},IP:127.0.0.1,DNS:localhost`;
  
  execSync(
    `openssl req -new -x509 -key "${KEY_PATH}" -out "${CERT_PATH}" -days 365 -subj "${subj}" -addext "${san}"`,
    { stdio: 'inherit' }
  );
  
  console.log('[Cert] ✅ OpenSSL로 인증서 생성 완료');
}

// selfsigned 패키지로 인증서 생성
async function generateWithSelfSigned(lanIP) {
  console.log('[Cert] selfsigned 패키지를 사용하여 인증서 생성 중...');
  
  try {
    const selfsigned = require('selfsigned');
    
    const attrs = [
      { name: 'commonName', value: lanIP },
      { name: 'countryName', value: 'KR' },
      { name: 'stateOrProvinceName', value: 'Seoul' },
      { name: 'localityName', value: 'Seoul' },
      { name: 'organizationName', value: 'LANBridge' }
    ];
    
    const options = {
      days: 365,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'subjectAltName',
          altNames: [
            { type: 7, ip: lanIP },
            { type: 7, ip: '127.0.0.1' },
            { type: 2, value: 'localhost' }
          ]
        }
      ]
    };
    
    const pems = selfsigned.generate(attrs, options);
    
    fs.writeFileSync(KEY_PATH, pems.private, 'utf8');
    fs.writeFileSync(CERT_PATH, pems.cert, 'utf8');
    
    console.log('[Cert] ✅ selfsigned로 인증서 생성 완료');
    return true;
  } catch (error) {
    console.error('[Cert] selfsigned 패키지 오류:', error.message);
    return false;
  }
}

// 인증서 생성 메인 함수
async function generateCertificate() {
  console.log('========================================');
  console.log('LANBridge HTTPS 인증서 자동 생성');
  console.log('========================================\n');
  
  // certs 디렉토리 생성
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    console.log('[Cert] certs 디렉토리 생성됨');
  }
  
  // 기존 인증서 확인
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    console.log('[Cert] ⚠️  기존 인증서가 존재합니다.');
    console.log('[Cert] 계속하려면 기존 파일을 삭제하고 다시 실행하세요.\n');
    console.log(`  del "${CERT_PATH}"`);
    console.log(`  del "${KEY_PATH}"`);
    return false;
  }
  
  const lanIP = getLanIP();
  console.log(`[Cert] LAN IP: ${lanIP}\n`);
  
  // OpenSSL 우선 시도
  if (isOpenSSLAvailable()) {
    try {
      generateWithOpenSSL(lanIP);
      printSuccess(lanIP);
      return true;
    } catch (error) {
      console.error('[Cert] OpenSSL 생성 실패:', error.message);
      console.log('[Cert] selfsigned 패키지로 재시도...\n');
    }
  }
  
  // selfsigned 패키지 시도
  const success = await generateWithSelfSigned(lanIP);
  if (success) {
    printSuccess(lanIP);
    return true;
  }
  
  // 모든 방법 실패
  console.error('\n========================================');
  console.error('❌ 인증서 생성 실패');
  console.error('========================================');
  console.error('해결 방법:');
  console.error('1. OpenSSL 설치: choco install openssl');
  console.error('2. selfsigned 패키지 설치: npm install selfsigned');
  console.error('3. 수동 생성: generate-cert.bat 실행');
  console.error('========================================\n');
  return false;
}

function printSuccess(lanIP) {
  console.log('\n========================================');
  console.log('✅ 인증서 생성 완료!');
  console.log('========================================');
  console.log('파일 위치:');
  console.log(`- 개인키: ${KEY_PATH}`);
  console.log(`- 인증서: ${CERT_PATH}`);
  console.log('\n다음 단계:');
  console.log('1. node signal-server.js 실행');
  console.log(`2. 브라우저에서 https://${lanIP}:3000 접속`);
  console.log('3. "주의 필요" 경고 → "고급" → "계속" 클릭');
  console.log('========================================\n');
}

// 직접 실행 시
if (require.main === module) {
  generateCertificate().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { generateCertificate, CERT_PATH, KEY_PATH };
