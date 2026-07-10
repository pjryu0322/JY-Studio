import Link from "next/link";
import { AdminReviewListPageClient } from "@/components/AdminReviewListPageClient";
import {
  ADMIN_CONSOLE_TITLE,
  ADMIN_REVIEWS_LIST_TITLE,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

export default function AdminReviewsPage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.admin}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← {ADMIN_CONSOLE_TITLE}
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">{ADMIN_CONSOLE_TITLE}</h1>
        <p className="mt-1 text-sm text-store-muted">{ADMIN_REVIEWS_LIST_TITLE}</p>
      </div>
      <AdminReviewListPageClient />
    </div>
  );
}
