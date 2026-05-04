"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { MAX_PLATFORM_NICKNAME_LENGTH } from "@/lib/user/platformProfile";

type MeDto = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  displayName: string;
  avatarUrl: string | null;
  platformRole: string;
  globalRole: string;
  accountStatus: string;
  planTier: string;
  lastLoginAt: string | null;
  humanProjectCount: number;
  createdAt: string;
};

function planLabel(tier: string): string {
  const t = String(tier ?? "").trim().toLowerCase();
  if (t === "free") return "무료";
  if (t === "pro" || t === "team") return "유료(팀)";
  return tier || "—";
}

function sectionCard(title: string, children: React.ReactNode) {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 16,
        background: "#fff",
      }}
    >
      <h2 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{title}</h2>
      {children}
    </section>
  );
}

function kv(k: string, v: React.ReactNode) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
      <div style={{ width: 120, flexShrink: 0, fontWeight: 700, color: "#64748b" }}>{k}</div>
      <div style={{ flex: 1, color: "#0f172a", minWidth: 0 }}>{v}</div>
    </div>
  );
}

export default function AccountPage() {
  const [me, setMe] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<"ok" | "err">("ok");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await credentialsIncludeFetch("/api/auth/me");
      const json = (await res.json()) as { success?: boolean; data?: MeDto | null };
      if (!res.ok || !json.success || !json.data) {
        setMe(null);
        return;
      }
      setMe(json.data);
      setNicknameDraft(json.data.nickname ?? "");
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveNickname = useCallback(async () => {
    setProfileBusy(true);
    setBanner(null);
    try {
      const res = await credentialsIncludeFetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nicknameDraft }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setBannerTone("err");
        setBanner(json.message || "닉네임을 저장하지 못했습니다.");
        return;
      }
      setBannerTone("ok");
      setBanner(json.message || "저장했습니다.");
      await load();
    } catch {
      setBannerTone("err");
      setBanner("요청 중 오류가 발생했습니다.");
    } finally {
      setProfileBusy(false);
    }
  }, [nicknameDraft, load]);

  const uploadAvatar = useCallback(
    async (file: File) => {
      setAvatarBusy(true);
      setBanner(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        const res = await credentialsIncludeFetch("/api/me/avatar", { method: "POST", body: fd });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          setBannerTone("err");
          setBanner(json.message || "이미지를 올리지 못했습니다.");
          return;
        }
        setBannerTone("ok");
        setBanner(json.message || "프로필 사진을 저장했습니다.");
        await load();
      } catch {
        setBannerTone("err");
        setBanner("요청 중 오류가 발생했습니다.");
      } finally {
        setAvatarBusy(false);
      }
    },
    [load]
  );

  const removeAvatar = useCallback(async () => {
    setAvatarBusy(true);
    setBanner(null);
    try {
      const res = await credentialsIncludeFetch("/api/me/avatar", { method: "DELETE" });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setBannerTone("err");
        setBanner(json.message || "삭제에 실패했습니다.");
        return;
      }
      setBannerTone("ok");
      setBanner(json.message || "삭제했습니다.");
      await load();
    } catch {
      setBannerTone("err");
      setBanner("요청 중 오류가 발생했습니다.");
    } finally {
      setAvatarBusy(false);
    }
  }, [load]);

  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <p style={{ color: "#64748b" }}>불러오는 중…</p>
      </main>
    );
  }

  if (!me) {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>내 계정</h1>
        <p style={{ color: "#64748b", marginTop: 12 }}>로그인이 필요합니다.</p>
        <Link href="/login?from=/account" style={{ display: "inline-block", marginTop: 16, fontWeight: 800, color: "#2563eb" }}>
          로그인
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ fontSize: 14, fontWeight: 700, color: "#2563eb", textDecoration: "none" }}>
          ← 홈
        </Link>
      </div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>내 계정</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
          플랫폼 전역 계정입니다. 프로젝트에 누구를 초대할지는 각 프로젝트의{" "}
          <strong style={{ color: "#334155" }}>프로젝트 멤버 관리</strong>에서 다룹니다.
        </p>
      </header>

      {banner ? (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 10,
            background: bannerTone === "err" ? "#fef2f2" : "#f0fdf4",
            border: bannerTone === "err" ? "1px solid #fecaca" : "1px solid #86efac",
            color: bannerTone === "err" ? "#991b1b" : "#14532d",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {banner}
        </div>
      ) : null}

      {sectionCard("프로필", (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ flexShrink: 0 }}>
              {me.avatarUrl ? (
                <img
                  src={me.avatarUrl}
                  alt=""
                  width={88}
                  height={88}
                  style={{ borderRadius: 12, objectFit: "cover", border: "1px solid #e2e8f0", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 12,
                    border: "1px dashed #cbd5e1",
                    background: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#94a3b8",
                  }}
                >
                  사진 없음
                </div>
              )}
            </div>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <p style={{ margin: "0 0 6px 0", fontSize: 12, fontWeight: 800, color: "#64748b" }}>프로필 사진</p>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadAvatar(f);
                }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: avatarBusy ? "wait" : "pointer",
                  }}
                >
                  사진 올리기
                </button>
                <button
                  type="button"
                  disabled={avatarBusy || !me.avatarUrl}
                  onClick={() => void removeAvatar()}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: avatarBusy || !me.avatarUrl ? "not-allowed" : "pointer",
                  }}
                >
                  사진 삭제
                </button>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>JPEG·PNG·WebP·GIF, 최대 2MB</p>
            </div>
          </div>
          <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>닉네임</label>
                <input
                  type="text"
                  value={nicknameDraft}
                  maxLength={MAX_PLATFORM_NICKNAME_LENGTH}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  placeholder="플랫폼에 표시될 이름"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 11px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                  }}
                />
              </div>
              <button
                type="button"
                disabled={profileBusy}
                onClick={() => void saveNickname()}
                style={{
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0d9488",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: profileBusy ? "wait" : "pointer",
                }}
              >
                닉네임 저장
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>
              비워 두면 실명이 표시됩니다. 현재 표시명: <strong style={{ color: "#0f172a" }}>{me.displayName}</strong>
            </p>
          </div>
          {kv("실명", me.name)}
          {kv("가입일", new Date(me.createdAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }))}
        </>
      ))}

      {sectionCard("로그인 정보", (
        <>
          {kv("이메일", me.email)}
          {kv("비밀번호", (
            <span style={{ color: "#64748b" }}>
              변경 기능은 준비 중입니다. 필요 시 관리자에게 요청하세요.
            </span>
          ))}
        </>
      ))}

      {sectionCard("플랜", (
        <>
          {kv("현재 플랜", planLabel(me.planTier))}
          {kv("플랫폼 역할", `${me.platformRole} (${me.globalRole})`)}
          {kv("계정 상태", me.accountStatus === "SUSPENDED" ? "정지됨" : "활성")}
        </>
      ))}

      {sectionCard("외부 연동", (
        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 10px 0" }}>
            OpenAI 등 자격 증명은 <strong style={{ color: "#0f172a" }}>Integrations</strong>에서 사용자 단위로 등록합니다. 프로젝트별로 어떤 연동을 쓸지는 실행 환경 설정에서 선택합니다.
          </p>
          <Link
            href="/integrations"
            style={{ display: "inline-block", fontWeight: 800, color: "#2563eb", textDecoration: "none", fontSize: 14 }}
          >
            Integrations 관리로 이동 →
          </Link>
        </div>
      ))}

      {sectionCard("사용량", (
        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 8px 0" }}>
            참여 중인 프로젝트(사람 멤버십) 수: <strong style={{ color: "#0f172a" }}>{me.humanProjectCount}</strong>
          </p>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            LLM 토큰·호출 수 등 상세 사용량 집계는 추후 대시보드에 연결할 예정입니다.
          </p>
        </div>
      ))}

      {sectionCard("접속", (
        <>
          {kv(
            "마지막 로그인",
            me.lastLoginAt
              ? new Date(me.lastLoginAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })
              : "—",
          )}
        </>
      ))}
    </main>
  );
}
