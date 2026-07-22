import { ForbiddenException } from "@nestjs/common";
import { AnalyticsAuthService } from "./analytics-auth.service";

describe("AnalyticsAuthService project boundaries", () => {
  const metadata = { getProjectWorkspaceId: jest.fn(), getProjectMember: jest.fn() };
  const service = new AnalyticsAuthService(metadata as never);
  const businessUser = { id: "actor_1", workspaceId: "workspace_1", workspaceRole: "business_user" as const };

  beforeEach(() => jest.resetAllMocks());

  it("denies a project from a different workspace before it can be read", async () => {
    metadata.getProjectWorkspaceId.mockResolvedValue("workspace_2");
    await expect(service.requireProjectPermission(businessUser, "project_2", "projects.view")).rejects.toBeInstanceOf(ForbiddenException);
    expect(metadata.getProjectMember).not.toHaveBeenCalled();
  });

  it("allows a business user to run a permitted prediction but not change a pipeline", async () => {
    metadata.getProjectWorkspaceId.mockResolvedValue("workspace_1");
    metadata.getProjectMember.mockResolvedValue(undefined);
    await expect(service.requireProjectPermission(businessUser, "project_1", "predictions.run")).resolves.toEqual(expect.objectContaining({ workspaceId: "workspace_1" }));
    await expect(service.requireProjectPermission(businessUser, "project_1", "pipelines.edit")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("uses an explicit project role when one exists", async () => {
    metadata.getProjectWorkspaceId.mockResolvedValue("workspace_1");
    metadata.getProjectMember.mockResolvedValue({ projectId: "project_1", actorId: "actor_1", role: "viewer" });
    await expect(service.requireProjectPermission({ ...businessUser, workspaceRole: "admin" }, "project_1", "predictions.run")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
