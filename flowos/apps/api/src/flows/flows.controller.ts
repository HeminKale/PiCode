import { Controller, Post, Get, Delete, Body, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { FlowsService } from "./flows.service";
import { GenerateFlowDto } from "./dto/generate-flow.dto";
import { CreateFlowDto } from "./dto/create-flow.dto";

@ApiTags("flows")
@Controller("flows")
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Post("generate")
  @ApiOperation({ summary: "Generate a Flow JSON from a plain-language prompt via the LLM" })
  @ApiResponse({ status: 201, description: "Returns the generated flow (not yet persisted) and a short reasoning note" })
  generate(@Body() dto: GenerateFlowDto) {
    return this.flowsService.generateFlow(dto);
  }

  @Post()
  @ApiOperation({ summary: "Save a flow (creates if new id, updates if id already exists)" })
  create(@Body() dto: CreateFlowDto) {
    return this.flowsService.createFlow(dto);
  }

  @Get()
  @ApiOperation({ summary: "List all saved flows" })
  list() {
    return this.flowsService.listFlows();
  }

  @Get("apps")
  @ApiOperation({ summary: "List published business applications" })
  apps() { return this.flowsService.listPublishedApps(); }

  @Get("components")
  @ApiOperation({ summary: "List published flows with a published display bundle for Page Builder" })
  components() { return this.flowsService.listComponentEligibleFlows(); }

  @Get(":id")
  @ApiOperation({ summary: "Get a single flow's full JSON" })
  get(@Param("id") id: string) {
    return this.flowsService.getFlow(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a flow" })
  remove(@Param("id") id: string) {
    return this.flowsService.deleteFlow(id);
  }

  @Post(":id/generate-java")
  @ApiOperation({ summary: "Generate a compilable {FlowName}Processor Java class from the flow JSON via the LLM" })
  generateJava(@Param("id") id: string) {
    return this.flowsService.generateJavaProcessor(id);
  }

  @Get(":id/viewer.pdf")
  async viewerPdf(@Param("id") id: string, @Res() response: Response) {
    const pdf = await this.flowsService.generateViewerPdf(id);
    response.type("application/pdf").attachment("flow-viewer.pdf").send(pdf);
  }
}
