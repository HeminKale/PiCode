import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AnalyticsActor } from "./analytics-auth.service";
import type { AnalyticsRequest } from "./analytics-auth.guard";

export const AnalyticsActorParam = createParamDecorator((_: unknown, context: ExecutionContext): AnalyticsActor => {
  const actor = context.switchToHttp().getRequest<AnalyticsRequest>().analyticsActor;
  if (!actor) throw new Error("Analytics actor is missing after authentication.");
  return actor;
});
