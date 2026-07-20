import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Flow } from "@flowos/types";
import { PrismaService } from "../prisma/prisma.service";
import { LLMService } from "../llm/llm.service";
import { GenerateFlowDto } from "./dto/generate-flow.dto";
import { CreateFlowDto } from "./dto/create-flow.dto";
import { GENERATE_JAVA_PROCESSOR_SYSTEM_PROMPT } from "./generate-java.prompt";
import puppeteer from "puppeteer";

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
        icon: dto.icon,
        category: dto.category,
        isPublished: dto.isPublished ?? false,
      },
      update: {
        name: dto.name,
        description: dto.description,
        flowJson: flowJson as object,
        tags: dto.tags ?? [],
        icon: dto.icon,
        category: dto.category,
        isPublished: dto.isPublished ?? false,
        version: { increment: 1 },
      },
    });

    return record;
  }

  async listFlows() {
    return this.prisma.flow.findMany({
      select: { id: true, name: true, description: true, tags: true, icon: true, category: true, isPublished: true, updatedAt: true },
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

  async generateJavaProcessor(id: string): Promise<{ source: string; className: string }> {
    const record = await this.getFlow(id);
    const flow = record.flowJson as unknown as Flow;
    const className = `${this.toPascalCase(flow.name)}Processor`;

    const userPrompt = `Class name: ${className}\n\nFlow JSON:\n${JSON.stringify({ name: flow.name, description: flow.description, nodes: flow.nodes, edges: flow.edges }, null, 2)}`;
    const raw = await this.llm.generate(GENERATE_JAVA_PROCESSOR_SYSTEM_PROMPT, userPrompt, { maxTokens: 4000 });
    const source = raw.replace(/^```(?:java)?\s*/i, "").replace(/```\s*$/i, "").trim();

    return { source, className };
  }

  async listPublishedApps() {
    return this.prisma.flow.findMany({ where: { isPublished: true }, select: { id: true, name: true, description: true, icon: true, category: true, updatedAt: true }, orderBy: { updatedAt: "desc" } });
  }

  async generateViewerPdf(id: string): Promise<Buffer> {
    const record = await this.getFlow(id);
    const flow = record.flowJson as unknown as Flow;
    const latest = await this.prisma.flowRun.findFirst({ where: { flowId: id }, orderBy: { startedAt: "desc" } });
    const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
    const steps = flow.nodes.map((node, index) => `<li><strong>${index + 1}. ${escape(node.label)}</strong><br>${escape(node.metadata?.description ?? `${node.type.replaceAll("_", " ").toLowerCase()} step.`)}</li>`).join("");
    const browser = await puppeteer.launch({ headless: true });
    try { const page = await browser.newPage(); await page.setContent(`<html><body><h1>${escape(flow.name)}</h1><p>${escape(flow.description)}</p><h2>Last run</h2><p>${escape(latest ? `${latest.status} · ${Array.isArray(latest.nodeLogs) ? latest.nodeLogs.length : 0} node logs` : "No runs yet")}</p><h2>Flow steps</h2><ol>${steps}</ol></body></html>`); return Buffer.from(await page.pdf({ format: "A4", printBackground: true })); } finally { await browser.close(); }
  }

  private toPascalCase(name: string): string {
    const words = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    return words.map((w) => w[0].toUpperCase() + w.slice(1)).join("") || "Flow";
  }
}
