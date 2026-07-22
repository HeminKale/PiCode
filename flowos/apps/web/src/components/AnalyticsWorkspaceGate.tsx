"use client";

import Link from "next/link";
import { useWorkspaceAuth } from "./WorkspaceAuthProvider";

export function AnalyticsWorkspaceGate({ children }: { children: React.ReactNode }) {
  const auth = useWorkspaceAuth();
  if (auth.status === "ready") return <>{children}</>;

  const content = auth.status === "loading" || auth.status === "loading_workspaces"
    ? ["Checking your Analytics access", "Restoring your signed-in session and workspace memberships."]
    : auth.status === "signed_out"
      ? ["Sign in to use Analytics", "Analytics requires a signed-in Supabase user and an active workspace membership."]
      : auth.status === "configuration_required"
        ? ["Authentication needs configuration", auth.error ?? "Configure the browser-safe Supabase environment variables before using Analytics."]
        : auth.status === "no_workspace_access"
          ? ["No Analytics workspace access", "Your signed-in user has no active Analytics workspace membership. Ask a workspace owner or admin to add one."]
          : auth.status === "workspace_selection_required"
            ? ["Select an Analytics workspace", "Choose one of your permitted workspaces from the navigation bar before opening Analytics."]
            : ["Analytics access could not be verified", auth.error ?? "Try again after checking your session and workspace membership."];

  return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8">
    <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Analytics</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{content[0]}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{content[1]}</p>
      {auth.status === "signed_out" && <Link href="/sign-in" className="mt-5 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Sign in</Link>}
      {auth.status === "error" && <button type="button" onClick={() => void auth.retryWorkspaceLoad()} className="mt-5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Try again</button>}
    </section>
  </main>;
}
