import { describe, expect, it } from "vitest";
import {
  apiFetch,
  apiLogin,
  BASE_URL,
  cookieHeaderFromResponse,
  SEED_OWNER_EMAIL,
  SEED_OWNER_PASSWORD,
} from "./helpers";

describe("auth API", () => {
  it("[AUTH-001] 회원가입 성공", async () => {
    const email = `vitest.reg.${Date.now()}@jyo.test`;
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Vitest User",
        email,
        password: SEED_OWNER_PASSWORD,
      }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { success?: boolean; data?: { email: string } };
    expect(json.success).toBe(true);
    expect(json.data?.email).toBe(email);
  });

  it("[AUTH-002] 중복 이메일 실패", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dup",
        email: SEED_OWNER_EMAIL,
        password: SEED_OWNER_PASSWORD,
      }),
    });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { success?: boolean };
    expect(json.success).toBe(false);
  });

  it("[AUTH-003] 로그인 성공", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    expect(cookie).toContain("jyo_session=");
  });

  it("[AUTH-004] 로그인 후 /api/auth/me", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const res = await apiFetch("/api/auth/me", { cookie });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean; data?: { email: string } };
    expect(json.success).toBe(true);
    expect(json.data?.email).toBe(SEED_OWNER_EMAIL);
  });

  it("[AUTH-005] 로그아웃 후 세션 없음", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const logoutRes = await apiFetch("/api/auth/logout", { method: "POST", cookie });
    expect(logoutRes.status).toBe(200);
    const meRes = await apiFetch("/api/auth/me", {});
    expect(meRes.status).toBe(200);
    const json = (await meRes.json()) as { success?: boolean; data?: unknown };
    expect(json.data).toBeNull();
  });

  it("[AUTH-006] 회원가입 응답 쿠키로 me 조회", async () => {
    const email = `vitest.cookie.${Date.now()}@jyo.test`;
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cookie User",
        email,
        password: SEED_OWNER_PASSWORD,
      }),
    });
    expect(res.status).toBe(201);
    const cookie = cookieHeaderFromResponse(res);
    expect(cookie).toContain("jyo_session=");
    const me = await apiFetch("/api/auth/me", { cookie });
    const j = (await me.json()) as { data?: { email: string } };
    expect(j.data?.email).toBe(email);
  });
});
