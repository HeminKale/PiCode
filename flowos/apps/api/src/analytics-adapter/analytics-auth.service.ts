import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AnalyticsMetadataService, type AnalyticsProjectMember, type AnalyticsWorkspaceMember } from "./analytics-metadata.service";

export type AnalyticsRole = "owner" | "admin" | "manager" | "analyst" | "business_user" | "viewer";
export type AnalyticsPermission =
  | "projects.view" | "projects.create" | "datasets.upload" | "pipelines.edit" | "pipelines.approve"
  | "models.train" | "models.approve" | "predictions.run" | "audit.view" | "retention.manage" | "operations.view";

export type AnalyticsActor = { id: string; email?: string; workspaceId: string; workspaceRole: AnalyticsRole; projectRole?: AnalyticsRole };

const permissions: Record<AnalyticsPermission, AnalyticsRole[]> = {
  "projects.view": ["owner", "admin", "manager", "analyst", "business_user", "viewer"],
  "projects.create": ["owner", "admin"],
  "datasets.upload": ["owner", "admin", "manager", "analyst"],
  "pipelines.edit": ["owner", "admin", "manager", "analyst"],
  "pipelines.approve": ["owner", "admin", "manager"],
  "models.train": ["owner", "admin", "manager", "analyst"],
  "models.approve": ["owner", "admin", "manager"],
  "predictions.run": ["owner", "admin", "manager", "analyst", "business_user"],
  "audit.view": ["owner", "admin", "manager"],
  "retention.manage": ["owner", "admin"],
  "operations.view": ["owner", "admin", "manager", "analyst"],
};

@Injectable()
export class AnalyticsAuthService {
  private readonly url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  private readonly serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  constructor(private readonly metadata: AnalyticsMetadataService) {}

  async authenticate(request: Request): Promise<AnalyticsActor> {
    const workspaceId = String(request.headers["x-workspace-id"] ?? "").trim();
    if (!workspaceId) throw new UnauthorizedException("Analytics requires an authenticated workspace selection.");
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(workspaceId)) throw new UnauthorizedException("Analytics workspace selection is invalid.");
    const authorization = String(request.headers.authorization ?? "");
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException("Analytics requires a signed-in user token.");
    if (!this.url || !this.serviceRoleKey) throw new ServiceUnavailableException("Analytics authentication is unavailable: configure Supabase server credentials.");

    let response: Response;
    try {
      response = await fetch(`${this.url}/auth/v1/user`, { headers: { apikey: this.serviceRoleKey, Authorization: `Bearer ${token}` } });
    } catch {
      throw new ServiceUnavailableException("Analytics authentication provider is unavailable.");
    }
    const user = await response.json().catch(() => null) as { id?: unknown; email?: unknown } | null;
    if (!response.ok || typeof user?.id !== "string") throw new UnauthorizedException("Analytics user token is invalid or expired.");
    const membership = await this.metadata.getWorkspaceMember(workspaceId, user.id);
    if (!membership) throw new ForbiddenException("You are not an active member of this Analytics workspace.");
    return { id: user.id, email: typeof user.email === "string" ? user.email : undefined, workspaceId, workspaceRole: membership.role };
  }

  async requireProjectPermission(actor: AnalyticsActor, projectId: string, permission: AnalyticsPermission): Promise<AnalyticsActor> {
    const workspaceId = await this.metadata.getProjectWorkspaceId(projectId);
    // Return the same indistinguishable response for another workspace to avoid project enumeration.
    if (!workspaceId || workspaceId !== actor.workspaceId) throw new ForbiddenException("You do not have access to this Analytics project.");
    const membership = await this.metadata.getProjectMember(projectId, actor.id);
    const effectiveRole = membership?.role ?? actor.workspaceRole;
    if (!permissions[permission].includes(effectiveRole)) throw new ForbiddenException(`Your Analytics role cannot ${permission.replace(".", " ")}.`);
    return { ...actor, projectRole: membership?.role };
  }

  requireWorkspacePermission(actor: AnalyticsActor, permission: AnalyticsPermission): AnalyticsActor {
    if (!permissions[permission].includes(actor.workspaceRole)) throw new ForbiddenException(`Your Analytics role cannot ${permission.replace(".", " ")}.`);
    return actor;
  }

  static roleAllows(role: AnalyticsRole, permission: AnalyticsPermission): boolean {
    return permissions[permission].includes(role);
  }
}

export type { AnalyticsProjectMember, AnalyticsWorkspaceMember };
