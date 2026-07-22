"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useWorkspaceAuth } from "@/components/WorkspaceAuthProvider";

type AuthMode = "sign_in" | "sign_up" | "forgot_password";
const MIN_PASSWORD_LENGTH = 12;

export function SignInPage() {
  const auth = useWorkspaceAuth();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError(undefined); setMessage(undefined);
    if (mode === "sign_in") {
      const reason = await auth.signIn(email, password);
      if (reason) setError(reason);
    } else if (mode === "sign_up") {
      if (password.length < MIN_PASSWORD_LENGTH) setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      else {
        const result = await auth.signUp(email, password);
        setError(result.error); setMessage(result.message);
      }
    } else {
      const result = await auth.requestPasswordReset(email);
      setError(result.error); setMessage(result.message);
    }
    setSubmitting(false);
  }

  if (auth.status === "ready" || auth.status === "workspace_selection_required" || auth.status === "no_workspace_access") {
    const message = auth.status === "ready" ? "Your Analytics workspace is ready."
      : auth.status === "workspace_selection_required" ? "Choose an Analytics workspace from the navigation bar to continue."
        : "Your account has no active Analytics workspace membership. Ask a workspace owner or admin to add one.";
    return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8"><section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm"><h1 className="text-2xl font-bold tracking-tight">You are signed in</h1><p className="mt-3 text-sm leading-6 text-slate-600">{message}</p><Link href="/analytics" className="mt-5 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Open Analytics</Link></section></main>;
  }

  const title = mode === "sign_in" ? "Sign in" : mode === "sign_up" ? "Create an account" : "Reset your password";
  const description = mode === "sign_in" ? "Use your Supabase account. Analytics requires a selected active workspace after sign-in."
    : mode === "sign_up" ? "Create a Supabase account. A workspace owner or admin must grant Analytics access after email confirmation."
      : "Enter your email address to receive a secure password-reset link.";
  const submitLabel = mode === "sign_in" ? "Sign in" : mode === "sign_up" ? "Create account" : "Send reset link";

  return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8"><section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">FlowOS</p><h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    {(error || auth.status === "configuration_required" || auth.status === "error") && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error ?? auth.error}</p>}
    {message && <p role="status" className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p>}
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-sm font-medium">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
      {mode !== "forgot_password" && <label className="block text-sm font-medium">Password<input required minLength={mode === "sign_up" ? MIN_PASSWORD_LENGTH : undefined} type="password" autoComplete={mode === "sign_up" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />{mode === "sign_up" && <span className="mt-1 block text-xs font-normal text-slate-500">At least {MIN_PASSWORD_LENGTH} characters.</span>}</label>}
      <button disabled={submitting || auth.status === "configuration_required"} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Please wait..." : submitLabel}</button>
    </form>
    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm"><button type="button" onClick={() => { setMode("sign_in"); setError(undefined); setMessage(undefined); }} className="font-medium text-indigo-700 hover:text-indigo-900">Sign in</button><button type="button" onClick={() => { setMode("sign_up"); setError(undefined); setMessage(undefined); }} className="font-medium text-indigo-700 hover:text-indigo-900">Create account</button><button type="button" onClick={() => { setMode("forgot_password"); setError(undefined); setMessage(undefined); }} className="font-medium text-indigo-700 hover:text-indigo-900">Forgot password?</button></div>
  </section></main>;
}
