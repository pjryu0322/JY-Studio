import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** @deprecated Bookmark compatibility — KU drafts UI removed in P10. */
export default function AdminKnowledgeUnitDraftsPage() {
  redirect(ROUTES.adminReviews);
}
