import { AdminWorkInboxPageClient } from "@/components/AdminWorkInboxPageClient";
import { AdminConsoleWorkspace } from "@/components/role-workspace/AdminConsoleWorkspace";

export default function AdminPage() {
  return (
    <AdminConsoleWorkspace activeId="home">
      <AdminWorkInboxPageClient />
    </AdminConsoleWorkspace>
  );
}
