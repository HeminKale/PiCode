import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AnalyticsAuthService, type AnalyticsActor } from "./analytics-auth.service";

export type AnalyticsRequest = Request & { analyticsActor?: AnalyticsActor };

@Injectable()
export class AnalyticsAuthGuard implements CanActivate {
  constructor(private readonly auth: AnalyticsAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AnalyticsRequest>();
    request.analyticsActor = await this.auth.authenticate(request);
    return true;
  }
}
