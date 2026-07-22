import { ROUTES } from "@/lib/routes";
import type { RoleRailItem } from "@/lib/role-workspace/types";

export function getConsumerRailState(input: {
  activeId: string;
  hasMyPacks?: boolean;
  hasApiKey?: boolean;
  hasUsage?: boolean;
}): RoleRailItem[] {
  const { activeId, hasMyPacks, hasApiKey, hasUsage } = input;

  const items: Array<{ id: string; label: string; href: string }> = [
    { id: "explore", label: "지식팩 탐색", href: ROUTES.packs },
    { id: "myPacks", label: "내 지식팩", href: ROUTES.myPacks },
    { id: "apiKeys", label: "API Key", href: ROUTES.apiKeys },
    { id: "docs", label: "API/MCP 사용", href: ROUTES.apiDocs },
    { id: "account", label: "사용량/계정", href: ROUTES.account },
  ];

  return items.map((item) => {
    let status: RoleRailItem["status"] = "idle";
    if (item.id === activeId) status = "current";
    else if (item.id === "apiKeys" && hasMyPacks && !hasApiKey) status = "next";
    else if (item.id === "docs" && hasApiKey) status = "next";
    else if (item.id === "account" && hasUsage) status = "idle";
    else if (item.id === "myPacks" && hasMyPacks && activeId === "explore") status = "next";

    return { ...item, status };
  });
}
