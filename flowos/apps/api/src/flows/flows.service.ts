import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Flow } from "@flowos/types";
import { PrismaService } from "../prisma/prisma.service";
import { LLMService } from "../llm/llm.service";
import { GenerateFlowDto } from "./dto/generate-flow.dto";
import { CreateFlowDto } from "./dto/create-flow.dto";

@Injectable()
export class FlowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
  ) {}

  async generateFlow(dto: GenerateFlowDto) {
    return this.llm.generateFlow(dto.prompt, dto.context);
  }

  async createFlow(dto: CreateFlowDto) {
    const now = new Date().toISOString();
    const id = dto.id ?? randomUUID();

    const flowJson: Flow = {
      id,
      name: dto.name,
      description: dto.description ?? "",
      version: 1,
      createdAt: now,
      updatedAt: now,
      nodes: dto.nodes as Flow["nodes"],
      edges: dto.edges as Flow["edges"],
    };

    const record = await this.prisma.flow.upsert({
      where: { id },
      create: {
        id,
        name: dto.name,
        description: dto.description,
        flowJson: flowJson as object,
        tags: dto.tags ?? [],
      },
      update: {
        name: dto.name,
        description: dto.description,
        flowJson: flowJson as object,
        tags: dto.tags ?? [],
        version: { increment: 1 },
      },
    });

    return record;
  }

  async listFlows() {
    return this.prisma.flow.findMany({
      select: { id: true, name: true, description: true, tags: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getFlow(id: string) {
    const flow = await this.prisma.flow.findUnique({ where: { id } });
    if (!flow) throw new NotFoundException(`Flow ${id} not found`);
    return flow;
  }

  async deleteFlow(id: string) {
    await this.getFlow(id);
    await this.prisma.flow.delete({ where: { id } });
    return { deleted: true, id };
  }
}
