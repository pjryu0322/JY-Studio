import { redirect } from "next/navigation";
import { AdminWorkInboxPageClient } from "@/components/AdminWorkInboxPageClient";
import { AdminConsoleWorkspace } from "@/components/role-workspace/AdminConsoleWorkspace";
import { adminQueuePath } from "@/lib/routes";

type PageProps = {
  searchParams: Promise<{ queue?: string }>;
};

export default async function AdminPage({ searchParams }: PageProps) {
  const { queue } = await searchParams;
  if (!queue?.trim()) {
    redirect(adminQueuePath("receipt"));
  }

  return (
    <AdminConsoleWorkspace activeId="home">
      <AdminWorkInboxPageClient />
    </AdminConsoleWorkspace>
  );
}
