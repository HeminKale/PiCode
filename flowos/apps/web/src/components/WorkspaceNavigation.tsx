"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const linkClass = (active: boolean) => `rounded px-3 py-1.5 text-sm transition ${active ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`;

/**
 * Sprint 4.5 deliberately exposes both product surfaces for demos. This is navigation,
 * not authorization; Sprint 5 remains responsible for protecting Developer workspace.
 */
export function WorkspaceNavigation() {
  const pathname = usePathname();
  const inApplications = pathname === "/apps" || pathname.startsWith("/app/");
  const inAnalytics = pathname === "/analytics" || pathname.startsWith("/analytics/");
  const inDeveloperWorkspace = !inApplications && !inAnalytics;
  return <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-[#0d0d13] px-4 py-2 text-slate-100">
    <Link href="/apps" className="text-sm font-bold tracking-tight">FlowOS</Link>
    <nav aria-label="Workspace navigation" className="flex items-center gap-1">
      <Link href="/apps" className={linkClass(inApplications)}>Applications</Link>
      <Link href="/library" className={linkClass(inDeveloperWorkspace)}>Developer workspace</Link>
      <Link href="/analytics" className={linkClass(inAnalytics)}>Analytics</Link>
    </nav>
  </header>;
}
