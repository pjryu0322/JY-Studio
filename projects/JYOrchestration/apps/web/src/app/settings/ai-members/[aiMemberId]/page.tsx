import { PlatformAiMemberDetailClient } from "@/components/platform-ai/PlatformAiMemberDetailClient";

export const metadata = {
  title: "AI 멤버 상세 · JY Orchestration",
};

export default async function SettingsAiMemberDetailPage(props: { params: Promise<{ aiMemberId: string }> }) {
  const { aiMemberId } = await props.params;
  const id = String(aiMemberId ?? "").trim();
  return <PlatformAiMemberDetailClient aiMemberId={id} />;
}
