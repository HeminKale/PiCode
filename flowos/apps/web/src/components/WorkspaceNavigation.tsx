"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspaceAuth } from "./WorkspaceAuthProvider";

const linkClass = (active: boolean) => `rounded px-3 py-1.5 text-sm transition ${active ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`;

/**
 * Sprint 4.5 deliberately exposes both product surfaces for demos. This is navigation,
 * not authorization; Sprint 5 remains responsible for protecting Developer workspace.
 */
export function WorkspaceNavigation() {
  const pathname = usePathname();
  const auth = useWorkspaceAuth();
  const inApplications = pathname === "/apps" || pathname.startsWith("/app/");
  const inAnalytics = pathname === "/analytics" || pathname.startsWith("/analytics/");
  const inDeveloperWorkspace = !inApplications && !inAnalytics;
  return <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-[#0d0d13] px-4 py-2 text-slate-100">
    <Link href="/apps" className="text-sm font-bold tracking-tight">FlowOS</Link>
    <nav aria-label="Workspace navigation" className="flex items-center gap-1">
      <Link href="/apps" className={linkClass(inApplications)}>Applications</Link>
      <Link href="/library" className={linkClass(inDeveloperWorkspace)}>Developer workspace</Link>
      <Link href="/analytics" className={linkClass(inAnalytics)}>Analytics</Link>
    </nav>
    <div className="flex items-center gap-2 text-xs">
      {auth.status === "loading" || auth.status === "loading_workspaces" ? <span className="text-slate-400">Checking session...</span> : null}
      {auth.status === "signed_out" && <Link href="/sign-in" className="rounded border border-slate-600 px-2.5 py-1.5 font-semibold text-slate-100 hover:bg-slate-800">Sign in</Link>}
      {auth.session && <>
        {auth.memberships.length > 0 && <label className="flex items-center gap-1 text-slate-300">Workspace<select aria-label="Analytics workspace" value={auth.selectedWorkspaceId ?? ""} onChange={(event) => auth.selectWorkspace(event.target.value || undefined)} className="max-w-44 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white"><option value="">Select workspace</option>{auth.memberships.map((membership) => <option key={membership.workspaceId} value={membership.workspaceId}>{membership.workspaceId} ({membership.role})</option>)}</select></label>}
        {auth.status === "no_workspace_access" && <span className="text-amber-300">No Analytics workspace access</span>}
        <span className="hidden max-w-36 truncate text-slate-400 sm:inline" title={auth.session.user.email}>{auth.session.user.email}</span>
        <button type="button" onClick={() => void auth.signOut()} className="rounded border border-slate-600 px-2.5 py-1.5 font-semibold text-slate-100 hover:bg-slate-800">Sign out</button>
      </>}
    </div>
  </header>;
}
