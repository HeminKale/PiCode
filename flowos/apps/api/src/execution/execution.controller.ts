import { Body, Controller, Post, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ExecutionService } from "./execution.service";

@ApiTags("execution")
@Controller("flows")
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post(":id/run")
  @ApiOperation({ summary: "Start a mock run of a flow, returns a runId to subscribe to over Socket.io" })
  run(@Param("id") id: string) {
    return this.executionService.startRun(id);
  }

  @Get(":id/runs")
  @ApiOperation({ summary: "List all runs for a flow" })
  listRuns(@Param("id") id: string) {
    return this.executionService.listRunsForFlow(id);
  }

  @Get("runs/:runId")
  @ApiOperation({ summary: "Get a single run's status and node logs" })
  getRun(@Param("runId") runId: string) {
    return this.executionService.getRun(runId);
  }

  @Post("runs/:runId/resume")
  @ApiOperation({ summary: "Resume an awaiting DISPLAY run with validated form values" })
  resume(@Param("runId") runId: string, @Body() body: { values?: Record<string, unknown> }) {
    return this.executionService.resumeRun(runId, body.values ?? {});
  }
}
