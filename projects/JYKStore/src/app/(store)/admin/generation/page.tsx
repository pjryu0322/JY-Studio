import { redirect } from "next/navigation";
import { adminQueuePath } from "@/lib/routes";

/** @deprecated Prefer `/admin?queue=generation`. */
export default function AdminGenerationQueuePage() {
  redirect(adminQueuePath("generation"));
}
