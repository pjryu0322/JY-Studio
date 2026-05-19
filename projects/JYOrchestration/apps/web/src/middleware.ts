import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getSessionSecretKey, SESSION_COOKIE_NAME } from "@/lib/auth/session";

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }
  try {
    await jwtVerify(token, getSessionSecretKey());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /** Route Handlers — 미들웨어에서 리다이렉트하면 POST 로그인 등이 깨진다. */
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  /** `public/` 정적 파일 — 로그인 페이지로 리다이렉트하면 img·폰트 요청이 깨진다. */
  if (/\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?)$/i.test(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/login")) {
    if (await hasValidSession(request)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (await hasValidSession(request)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("from", pathname);
  const res = NextResponse.redirect(login);
  res.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}

/**
 * 이전에는 일부 경로만 matcher에 넣어 `/workspace`·`/chat` 등이 인증 없이 열렸다.
 * `api`·`_next`·favicon 을 제외한 앱 경로 전부에 세션 검사를 적용한다.
 */
export const config = {
  /** `/` 단독 경로는 일부 Next 버전에서 아래 패턴만으로는 매칭되지 않아 로그인 우회가 난다. */
  matcher: ["/", "/((?!api/|_next/|favicon\\.ico).*)"],
};
