import { redirect } from "next/navigation";

export default function WorkspacePage() {
  // Workspace is an alias of the existing overview/home surface.
  redirect("/");
}

