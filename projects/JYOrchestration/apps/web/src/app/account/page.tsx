"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useLayoutMobileBreakpoint } from "@/components/ui/breakpoints";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { MAX_PLATFORM_LEGAL_NAME_LENGTH, MAX_PLATFORM_NICKNAME_LENGTH } from "@/lib/user/platformProfile";

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

function sectionCard(title: string | null, children: React.ReactNode, narrow: boolean) {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: narrow ? 8 : 12,
        padding: narrow ? "10px 12px" : "16px 18px",
        marginBottom: narrow ? 10 : 16,
        background: "#fff",
      }}
    >
      {title ? (
        <h2 style={{ margin: narrow ? "0 0 8px 0" : "0 0 12px 0", fontSize: narrow ? 14 : 16, fontWeight: 900, color: "#0f172a" }}>
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

function kv(k: string, v: React.ReactNode, narrow: boolean) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: narrow ? 6 : 12,
        padding: narrow ? "6px 0" : "8px 0",
        borderBottom: "1px solid #f1f5f9",
        fontSize: narrow ? 13 : 14,
      }}
    >
      <div
        style={{
          width: narrow ? 92 : 120,
          flexShrink: 0,
          fontWeight: 700,
          color: "#64748b",
          whiteSpace: narrow ? "normal" : "nowrap",
          lineHeight: 1.35,
        }}
      >
        {k}
      </div>
      <div style={{ flex: 1, color: "#0f172a", minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>{v}</div>
    </div>
  );
}

function mainShellStyle(narrow: boolean): CSSProperties {
  return {
    padding: narrow
      ? "8px max(10px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-right))"
      : 24,
    maxWidth: 720,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  };
}

export default function AccountPage() {
  const narrow = useLayoutMobileBreakpoint();
  const [me, setMe] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<"ok" | "err">("ok");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

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
      setNameDraft(json.data.name ?? "");
      setEmailDraft(json.data.email ?? "");
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchProfile = useCallback(
    async (body: Record<string, unknown>, errFallback: string) => {
      setProfileBusy(true);
      setBanner(null);
      try {
        const res = await credentialsIncludeFetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          setBannerTone("err");
          setBanner(json.message || errFallback);
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
    },
    [load]
  );

  const saveNickname = useCallback(async () => {
    await patchProfile({ nickname: nicknameDraft }, "닉네임을 저장하지 못했습니다.");
  }, [nicknameDraft, patchProfile]);

  const saveName = useCallback(async () => {
    await patchProfile({ name: nameDraft }, "이름을 저장하지 못했습니다.");
  }, [nameDraft, patchProfile]);

  const saveEmail = useCallback(async () => {
    await patchProfile({ email: emailDraft }, "이메일을 저장하지 못했습니다.");
  }, [emailDraft, patchProfile]);

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

  const changePassword = useCallback(async () => {
    setPwdBusy(true);
    setBanner(null);
    if (pwdNew !== pwdConfirm) {
      setPwdBusy(false);
      setBannerTone("err");
      setBanner("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (pwdNew.length < 8) {
      setPwdBusy(false);
      setBannerTone("err");
      setBanner("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    try {
      const res = await credentialsIncludeFetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setBannerTone("err");
        setBanner(json.message || "비밀번호를 변경하지 못했습니다.");
        return;
      }
      setBannerTone("ok");
      setBanner(json.message || "비밀번호를 변경했습니다.");
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
      setPwdOpen(false);
    } catch {
      setBannerTone("err");
      setBanner("요청 중 오류가 발생했습니다.");
    } finally {
      setPwdBusy(false);
    }
  }, [pwdCurrent, pwdNew, pwdConfirm]);

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
      <main style={mainShellStyle(narrow)}>
        <p style={{ color: "#64748b" }}>불러오는 중…</p>
      </main>
    );
  }

  if (!me) {
    return (
      <main style={mainShellStyle(narrow)}>
        <h1 style={{ fontSize: narrow ? 18 : 20, fontWeight: 800, color: "#0f172a" }}>내 계정</h1>
        <p style={{ color: "#64748b", marginTop: 12 }}>로그인이 필요합니다.</p>
        <Link href="/login?from=/account" style={{ display: "inline-block", marginTop: 16, fontWeight: 800, color: "#2563eb" }}>
          로그인
        </Link>
      </main>
    );
  }

  return (
    <main style={mainShellStyle(narrow)}>
      {banner ? (
        <div
          role="status"
          style={{
            marginBottom: narrow ? 10 : 16,
            padding: narrow ? "8px 10px" : "10px 12px",
            borderRadius: narrow ? 8 : 10,
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

      {sectionCard(
        null,
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-start",
              gap: narrow ? 12 : 16,
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                width: 88,
              }}
            >
              <div style={{ position: "relative", alignSelf: "center" }}>
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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!avatarBusy) avatarInputRef.current?.click();
                  }}
                  onKeyDown={(e) => {
                    if (avatarBusy) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      avatarInputRef.current?.click();
                    }
                  }}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 12,
                    overflow: "hidden",
                    cursor: avatarBusy ? "wait" : "pointer",
                    outline: "none",
                    boxSizing: "border-box",
                    border: me.avatarUrl ? "1px solid #e2e8f0" : "1px dashed #cbd5e1",
                    background: "#f8fafc",
                  }}
                >
                  {me.avatarUrl ? (
                    <img
                      src={me.avatarUrl}
                      alt=""
                      width={88}
                      height={88}
                      style={{ display: "block", objectFit: "cover", width: "100%", height: "100%" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
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
                {me.avatarUrl ? (
                  <button
                    type="button"
                    disabled={avatarBusy}
                    aria-label="프로필 사진 삭제"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (!avatarBusy) void removeAvatar();
                    }}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 26,
                      height: 26,
                      padding: 0,
                      borderRadius: "50%",
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      fontSize: 16,
                      fontWeight: 900,
                      lineHeight: 1,
                      cursor: avatarBusy ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              {!pwdOpen ? (
                <button
                  type="button"
                  onClick={() => setPwdOpen(true)}
                  style={{
                    width: "100%",
                    padding: narrow ? "8px 6px" : "8px 6px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#0f172a",
                    fontWeight: 800,
                    fontSize: narrow ? 10 : 11,
                    lineHeight: 1.25,
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                >
                  비밀번호 변경
                </button>
              ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 0, alignSelf: "stretch" }}>
              <div
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  paddingBottom: narrow ? 8 : 10,
                  marginBottom: narrow ? 6 : 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "nowrap",
                    gap: narrow ? 6 : 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={nicknameDraft}
                    maxLength={MAX_PLATFORM_NICKNAME_LENGTH}
                    onChange={(e) => setNicknameDraft(e.target.value)}
                    placeholder="플랫폼에 표시될 이름"
                    style={{
                      flex: "1 1 auto",
                      minWidth: 0,
                      width: 0,
                      boxSizing: "border-box",
                      padding: narrow ? "6px 10px" : "8px 11px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: narrow ? 13 : 14,
                      lineHeight: narrow ? 1.35 : 1.4,
                    }}
                  />
                  <button
                    type="button"
                    disabled={profileBusy}
                    onClick={() => void saveNickname()}
                    style={{
                      flexShrink: 0,
                      padding: narrow ? "5px 10px" : "6px 12px",
                      minHeight: narrow ? 32 : 34,
                      borderRadius: 6,
                      border: "none",
                      background: "#0d9488",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: narrow ? 11 : 12,
                      cursor: profileBusy ? "wait" : "pointer",
                      boxSizing: "border-box",
                      whiteSpace: "nowrap",
                    }}
                  >
                    닉네임 저장
                  </button>
                </div>
              </div>
              <div
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  paddingBottom: narrow ? 8 : 10,
                  marginBottom: narrow ? 6 : 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "nowrap",
                    gap: narrow ? 6 : 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={nameDraft}
                    maxLength={MAX_PLATFORM_LEGAL_NAME_LENGTH}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="이름"
                    autoComplete="name"
                    style={{
                      flex: "1 1 auto",
                      minWidth: 0,
                      width: 0,
                      boxSizing: "border-box",
                      padding: narrow ? "6px 10px" : "8px 11px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: narrow ? 13 : 14,
                      lineHeight: narrow ? 1.35 : 1.4,
                    }}
                  />
                  <button
                    type="button"
                    disabled={profileBusy}
                    onClick={() => void saveName()}
                    style={{
                      flexShrink: 0,
                      padding: narrow ? "5px 10px" : "6px 12px",
                      minHeight: narrow ? 32 : 34,
                      borderRadius: 6,
                      border: "none",
                      background: "#0d9488",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: narrow ? 11 : 12,
                      cursor: profileBusy ? "wait" : "pointer",
                      boxSizing: "border-box",
                      whiteSpace: "nowrap",
                    }}
                  >
                    저장
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "nowrap",
                  gap: narrow ? 6 : 8,
                  alignItems: "center",
                }}
              >
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="이메일"
                  autoComplete="email"
                  style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    width: 0,
                    boxSizing: "border-box",
                    padding: narrow ? "6px 10px" : "8px 11px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: narrow ? 13 : 14,
                    lineHeight: narrow ? 1.35 : 1.4,
                  }}
                />
                <button
                  type="button"
                  disabled={profileBusy}
                  onClick={() => void saveEmail()}
                  style={{
                    flexShrink: 0,
                    padding: narrow ? "5px 10px" : "6px 12px",
                    minHeight: narrow ? 32 : 34,
                    borderRadius: 6,
                    border: "none",
                    background: "#0d9488",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: narrow ? 11 : 12,
                    cursor: profileBusy ? "wait" : "pointer",
                    boxSizing: "border-box",
                    whiteSpace: "nowrap",
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
          {pwdOpen ? (
            <div
              style={{
                marginTop: narrow ? 12 : 14,
                paddingTop: narrow ? 12 : 14,
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 6,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <input
                  type="password"
                  autoComplete="current-password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  placeholder="현재"
                  title="현재 비밀번호"
                  style={{
                    flex: "1 1 120px",
                    minWidth: 72,
                    padding: narrow ? "5px 8px" : "6px 9px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    fontSize: narrow ? 12 : 13,
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  placeholder="새 (8자+)"
                  title="새 비밀번호 (8자 이상)"
                  style={{
                    flex: "1 1 120px",
                    minWidth: 72,
                    padding: narrow ? "5px 8px" : "6px 9px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    fontSize: narrow ? 12 : 13,
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  placeholder="확인"
                  title="새 비밀번호 확인"
                  style={{
                    flex: "1 1 100px",
                    minWidth: 64,
                    padding: narrow ? "5px 8px" : "6px 9px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    fontSize: narrow ? 12 : 13,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  disabled={pwdBusy}
                  onClick={() => void changePassword()}
                  style={{
                    flexShrink: 0,
                    padding: narrow ? "5px 8px" : "6px 10px",
                    minHeight: narrow ? 30 : 32,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#0f172a",
                    fontWeight: 800,
                    fontSize: narrow ? 11 : 12,
                    cursor: pwdBusy ? "wait" : "pointer",
                    boxSizing: "border-box",
                    whiteSpace: "nowrap",
                  }}
                >
                  적용
                </button>
                <button
                  type="button"
                  disabled={pwdBusy}
                  onClick={() => {
                    setPwdOpen(false);
                    setPwdCurrent("");
                    setPwdNew("");
                    setPwdConfirm("");
                  }}
                  style={{
                    flexShrink: 0,
                    padding: narrow ? "5px 8px" : "6px 10px",
                    minHeight: narrow ? 30 : 32,
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: narrow ? 11 : 12,
                    cursor: pwdBusy ? "wait" : "pointer",
                    boxSizing: "border-box",
                    whiteSpace: "nowrap",
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          ) : null}
        </>
      ,
      narrow,
      )}

      {sectionCard(
        "외부 연동",
        <div style={{ fontSize: narrow ? 13 : 14, color: "#475569", lineHeight: narrow ? 1.5 : 1.6 }}>
          <p style={{ margin: narrow ? "0 0 6px 0" : "0 0 10px 0" }}>
            OpenAI 등 자격 증명은 <strong style={{ color: "#0f172a" }}>Integrations</strong>에서 사용자 단위로 등록합니다. 프로젝트별로 어떤 연동을 쓸지는 실행 환경 설정에서 선택합니다.
          </p>
          <Link
            href="/integrations"
            style={{ display: "inline-block", fontWeight: 800, color: "#2563eb", textDecoration: "none", fontSize: 14 }}
          >
            Integrations 관리로 이동 →
          </Link>
        </div>
      ,
      narrow,
      )}

      {sectionCard(
        "사용량",
        <div style={{ fontSize: narrow ? 13 : 14, color: "#475569", lineHeight: narrow ? 1.5 : 1.6 }}>
          <p style={{ margin: narrow ? "0 0 6px 0" : "0 0 8px 0" }}>
            참여 중인 프로젝트(사람 멤버십) 수: <strong style={{ color: "#0f172a" }}>{me.humanProjectCount}</strong>
          </p>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            LLM 토큰·호출 수 등 상세 사용량 집계는 추후 대시보드에 연결할 예정입니다.
          </p>
        </div>
      ,
      narrow,
      )}

      {sectionCard(
        "접속",
        <>
          {kv(
            "마지막 로그인",
            me.lastLoginAt
              ? new Date(me.lastLoginAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })
              : "—",
            narrow,
          )}
        </>
      ,
      narrow,
      )}
    </main>
  );
}
