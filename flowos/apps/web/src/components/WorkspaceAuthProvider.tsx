"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setAnalyticsAuthContext } from "@/lib/api";
import { getSupabaseBrowserClient, supabaseBrowserConfigurationError } from "@/lib/supabase";

export type AnalyticsWorkspaceRole = "owner" | "admin" | "manager" | "analyst" | "business_user" | "viewer";
export type AnalyticsWorkspaceMembership = { workspaceId: string; role: AnalyticsWorkspaceRole };
export type WorkspaceAuthStatus = "configuration_required" | "loading" | "signed_out" | "loading_workspaces" | "no_workspace_access" | "workspace_selection_required" | "ready" | "error";

type WorkspaceAuthContextValue = {
  status: WorkspaceAuthStatus;
  session: Session | null;
  memberships: AnalyticsWorkspaceMembership[];
  selectedWorkspaceId: string | undefined;
  error: string | undefined;
  selectWorkspace: (workspaceId: string | undefined) => void;
  signIn: (email: string, password: string) => Promise<string | undefined>;
  signOut: () => Promise<void>;
  retryWorkspaceLoad: () => Promise<void>;
};

const WorkspaceAuthContext = createContext<WorkspaceAuthContextValue | undefined>(undefined);

function sortMemberships(rows: AnalyticsWorkspaceMembership[]): AnalyticsWorkspaceMembership[] {
  return [...rows].sort((left, right) => left.workspaceId.localeCompare(right.workspaceId));
}

export function WorkspaceAuthProvider({ children }: { children: React.ReactNode }) {
  const configurationError = supabaseBrowserConfigurationError();
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<AnalyticsWorkspaceMembership[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | undefined>();
  const [loadingSession, setLoadingSession] = useState(!configurationError);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [error, setError] = useState<string | undefined>(configurationError);

  const loadMemberships = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) {
      setMemberships([]);
      setSelectedWorkspaceId(undefined);
      setLoadingMemberships(false);
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoadingMemberships(true);
    setError(undefined);
    const { data, error: membershipError } = await client
      .from("analytics_workspace_members")
      .select("workspace_id, role")
      .eq("actor_id", activeSession.user.id)
      .eq("status", "active");
    if (membershipError) {
      setMemberships([]);
      setSelectedWorkspaceId(undefined);
      setError(`Unable to load your Analytics workspaces: ${membershipError.message}`);
    } else {
      const next = sortMemberships((data ?? []).flatMap((row) => {
        const workspaceId = typeof row.workspace_id === "string" ? row.workspace_id.trim() : "";
        const role = row.role as AnalyticsWorkspaceRole;
        return workspaceId && ["owner", "admin", "manager", "analyst", "business_user", "viewer"].includes(role) ? [{ workspaceId, role }] : [];
      }));
      setMemberships(next);
      setSelectedWorkspaceId((current) => current && next.some((membership) => membership.workspaceId === current) ? current : undefined);
    }
    setLoadingMemberships(false);
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(`Unable to restore your session: ${sessionError.message}`);
      setSession(data.session);
      setLoadingSession(false);
      void loadMemberships(data.session);
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
      void loadMemberships(nextSession);
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, [loadMemberships]);

  const status: WorkspaceAuthStatus = configurationError ? "configuration_required"
    : loadingSession ? "loading"
      : !session ? "signed_out"
        : loadingMemberships ? "loading_workspaces"
          : error ? "error"
            : memberships.length === 0 ? "no_workspace_access"
              : !selectedWorkspaceId ? "workspace_selection_required"
                : "ready";

  useEffect(() => {
    setAnalyticsAuthContext(status === "ready" && session && selectedWorkspaceId
      ? { workspaceId: selectedWorkspaceId, accessToken: session.access_token }
      : undefined);
  }, [selectedWorkspaceId, session, status]);

  const selectWorkspace = useCallback((workspaceId: string | undefined) => {
    const nextWorkspaceId = workspaceId && memberships.some((membership) => membership.workspaceId === workspaceId) ? workspaceId : undefined;
    // Set the request context before Analytics children mount after a selection change.
    setAnalyticsAuthContext(nextWorkspaceId && session ? { workspaceId: nextWorkspaceId, accessToken: session.access_token } : undefined);
    setSelectedWorkspaceId(nextWorkspaceId);
  }, [memberships, session]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return supabaseBrowserConfigurationError() ?? "Supabase browser authentication is unavailable.";
    setError(undefined);
    const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
    return signInError?.message;
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    setAnalyticsAuthContext(undefined);
    setSession(null);
    setMemberships([]);
    setSelectedWorkspaceId(undefined);
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(`Unable to sign out: ${signOutError.message}`);
  }, []);

  const value = useMemo<WorkspaceAuthContextValue>(() => ({
    status, session, memberships, selectedWorkspaceId, error,
    selectWorkspace, signIn, signOut,
    retryWorkspaceLoad: async () => { await loadMemberships(session); },
  }), [error, loadMemberships, memberships, selectedWorkspaceId, session, signIn, signOut, status, selectWorkspace]);

  return <WorkspaceAuthContext.Provider value={value}>{children}</WorkspaceAuthContext.Provider>;
}

export function useWorkspaceAuth(): WorkspaceAuthContextValue {
  const context = useContext(WorkspaceAuthContext);
  if (!context) throw new Error("useWorkspaceAuth must be used within WorkspaceAuthProvider.");
  return context;
}
