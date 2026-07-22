import { AdminReviewListPageClient } from "@/components/AdminReviewListPageClient";
import { AdminConsoleWorkspace } from "@/components/role-workspace/AdminConsoleWorkspace";

export default function AdminReviewsPage() {
  return (
    <AdminConsoleWorkspace activeId="reviews">
      <AdminReviewListPageClient />
    </AdminConsoleWorkspace>
  );
}
