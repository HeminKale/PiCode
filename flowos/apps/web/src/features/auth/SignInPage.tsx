"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useWorkspaceAuth } from "@/components/WorkspaceAuthProvider";

export function SignInPage() {
  const auth = useWorkspaceAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const reason = await auth.signIn(email, password);
    if (reason) setError(reason);
    setSubmitting(false);
  }

  if (auth.status === "ready" || auth.status === "workspace_selection_required" || auth.status === "no_workspace_access") {
    const message = auth.status === "ready" ? "Your Analytics workspace is ready."
      : auth.status === "workspace_selection_required" ? "Choose an Analytics workspace from the navigation bar to continue."
        : "Your account has no active Analytics workspace membership. Ask a workspace owner or admin to add one.";
    return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8"><section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm"><h1 className="text-2xl font-bold tracking-tight">You are signed in</h1><p className="mt-3 text-sm leading-6 text-slate-600">{message}</p><Link href="/analytics" className="mt-5 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Open Analytics</Link></section></main>;
  }

  return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8"><section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">FlowOS</p><h1 className="mt-2 text-2xl font-bold tracking-tight">Sign in</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Use your Supabase account. Analytics will require you to select an active workspace after sign-in.</p>
    {(error || auth.status === "configuration_required" || auth.status === "error") && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error ?? auth.error}</p>}
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-sm font-medium">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
      <label className="block text-sm font-medium">Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
      <button disabled={submitting || auth.status === "configuration_required"} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Signing in..." : "Sign in"}</button>
    </form>
  </section></main>;
}
