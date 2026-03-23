/**
 * Mock ProjectSpec 파싱용: 자유 텍스트에서 기능 문장을 뽑아
 * Task 생성·프롬프트에 쓸 수 있게 한다 (LLM 파서 없이 동작).
 */

const SPLIT_RE = /[.\n;]+|\s+and\s+|\s+with\s+|그리고|및|,|와\s+/i;

function normalizePhrase(s: string): string {
  return s.replace(/^[\s"'“”]+|[\s"'“”]+$/g, "").trim();
}

/**
 * 업로드 본문에서 기능·요구 문장 후보를 추출한다.
 */
export function extractMainFeaturesFromFreeText(contentText: string): string[] {
  const raw = contentText.trim();
  if (!raw) {
    return [];
  }

  const chunks = raw
    .split(SPLIT_RE)
    .map(normalizePhrase)
    .filter((s) => s.length >= 3 && s.length <= 200);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of chunks) {
    const key = c.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(c);
    if (out.length >= 16) {
      break;
    }
  }

  return out;
}

/** 기능 문장을 구현 순서로 정렬 (로그인 → UI → 저장 등). */
export function orderFeaturesForImplementation(features: string[]): string[] {
  const score = (s: string): number => {
    const x = s.toLowerCase();
    if (/login|sign\s*in|auth|로그인|인증/.test(x)) {
      return 0;
    }
    if (/note|memo|메모|노트|ui|layout|screen|페이지|화면|web\s*app|앱/.test(x)) {
      return 1;
    }
    if (/save|persist|storage|저장|보관|동기/.test(x)) {
      return 2;
    }
    return 3;
  };
  return [...features].sort((a, b) => score(a) - score(b));
}

/** 비개발자용 짧은 작업 이름 (영·한 혼합 입력 대응). */
export function beginnerFriendlyTaskTitle(feature: string, index: number): string {
  const x = feature.toLowerCase();
  if (/login|sign\s*in|auth|로그인|인증/.test(x)) {
    return "로그인·계정 화면 만들기";
  }
  if (/save|persist|저장|보관/.test(x)) {
    return "메모 저장·불러오기 만들기";
  }
  if (/note|memo|메모|노트|taking/.test(x)) {
    return "메모 쓰기·목록 화면 만들기";
  }
  if (/simple|간단|basic/.test(x)) {
    return `기본 범위 정리하기 (${index + 1})`;
  }
  const short = feature.length > 48 ? `${feature.slice(0, 45)}…` : feature;
  return `기능 구현: ${short}`;
}
