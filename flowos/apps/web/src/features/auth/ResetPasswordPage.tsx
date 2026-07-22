"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useWorkspaceAuth } from "@/components/WorkspaceAuthProvider";

const MIN_PASSWORD_LENGTH = 12;

export function ResetPasswordPage() {
  const auth = useWorkspaceAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setSubmitting(true); setError(undefined);
    const reason = await auth.updatePassword(password);
    if (reason) setError(reason); else setComplete(true);
    setSubmitting(false);
  }

  return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8"><section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">FlowOS</p><h1 className="mt-2 text-2xl font-bold tracking-tight">Set a new password</h1>{complete ? <><p className="mt-3 text-sm leading-6 text-emerald-800">Your password has been updated. You can now sign in.</p><Link href="/sign-in" className="mt-5 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Sign in</Link></> : auth.session ? <form onSubmit={submit} className="mt-5 space-y-4"><p className="text-sm leading-6 text-slate-600">Choose a password with at least {MIN_PASSWORD_LENGTH} characters.</p>{error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}<label className="block text-sm font-medium">New password<input required minLength={MIN_PASSWORD_LENGTH} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label><label className="block text-sm font-medium">Confirm new password<input required minLength={MIN_PASSWORD_LENGTH} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label><button disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{submitting ? "Updating..." : "Update password"}</button></form> : <><p className="mt-3 text-sm leading-6 text-slate-600">This reset link is missing, expired, or has already been used. Request another password-reset email.</p><Link href="/sign-in" className="mt-5 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Request a new link</Link></>}</section></main>;
}
