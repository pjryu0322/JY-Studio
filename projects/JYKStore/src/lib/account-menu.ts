import type { AccountRole } from "@/lib/account-role";
import { ROUTES } from "@/lib/routes";

export type LogoutDestination = "login" | "home";

export const PROVIDER_PROFILE_PATH = `${ROUTES.accountProfile}#provider-profile`;

export function logoutDestinationPath(destination: LogoutDestination): string {
  switch (destination) {
    case "home":
      return ROUTES.home;
    default:
      return ROUTES.login;
  }
}

export function accountRoleDisplayLabel(role: AccountRole): string {
  switch (role) {
    case "ADMIN":
      return "관리자";
    case "PROVIDER":
      return "제공자";
    default:
      return "일반 사용자";
  }
}

export type AccountMenuLink = {
  href: string;
  label: string;
};

/** Role-scoped account menu links (logout is rendered separately). */
export function accountMenuLinksForRole(role: AccountRole): AccountMenuLink[] {
  switch (role) {
    case "ADMIN":
      return [
        { href: ROUTES.accountProfile, label: "계정 정보" },
        { href: ROUTES.admin, label: "할 일" },
        { href: ROUTES.adminOpsUsage, label: "운영 사용량" },
        { href: ROUTES.adminOpsAudit, label: "AuditLog" },
        { href: ROUTES.adminOps, label: "Ops 대시보드" },
        { href: ROUTES.adminReviews, label: "검수 대기 목록" },
        { href: ROUTES.home, label: "스토어 홈" },
      ];
    case "PROVIDER":
      return [
        { href: ROUTES.accountProfile, label: "계정 정보" },
        { href: PROVIDER_PROFILE_PATH, label: "제공자 정보" },
        { href: ROUTES.provider, label: "제공자 센터" },
        { href: ROUTES.home, label: "스토어 홈" },
      ];
    default:
      return [
        { href: ROUTES.accountProfile, label: "계정 정보" },
        { href: ROUTES.home, label: "스토어 홈" },
      ];
  }
}
