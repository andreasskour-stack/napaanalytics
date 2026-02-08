// src/app/projects/survivor-stats/explorer/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ExplorerRedirectPage() {
  redirect("/projects/survivor-stats/players");
}
