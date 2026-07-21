import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LLMService } from "../llm/llm.service";

const ARTIFACT_KINDS = new Set(["display", "java"]);
const FORBIDDEN_DISPLAY_SOURCE = /\b(fetch|XMLHttpRequest|WebSocket)\s*\(|\b(localStorage|sessionStorage)\b|document\.cookie|\bwindow\.top\b|\btop\.location\b|\blocation\.(href|assign|replace)\b|\bwindow\.location\b|<link\b|@import\b/i;

export function assertSafeDisplaySource(sourceCode: string) {
  if (FORBIDDEN_DISPLAY_SOURCE.test(sourceCode)) {
    throw new BadRequestException("Display bundles cannot use network, storage, navigation, or external stylesheet APIs");
  }
}

@Injectable()
export class ArtifactsService {
  constructor(private readonly prisma: PrismaService, private readonly llm: LLMService) {}
  private kind(value: string) { const kind = value.toLowerCase(); if (!ARTIFACT_KINDS.has(kind)) throw new BadRequestException(`Unsupported artifact kind: ${value}`); return kind; }
  private validateDisplaySource(sourceCode: string) {
    // Display artifacts run in an opaque-origin sandbox. Keep the authoring contract as
    // narrow as the runtime contract too: bundles are self-contained and cannot use host
    // storage, navigation, network APIs, or external stylesheets.
    assertSafeDisplaySource(sourceCode);
  }
  async createDraft(flowId: string, nodeId: string, kind: string, sourceCode: string) {
    const normalized = this.kind(kind);
    if (normalized === "display") this.validateDisplaySource(sourceCode);
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await this.prisma.$transaction(async (tx) => { const latest = await tx.artifact.aggregate({ where: { flowId, nodeId, kind: normalized }, _max: { version: true } }); return tx.artifact.create({ data: { flowId, nodeId, kind: normalized, sourceCode, version: (latest._max.version ?? 0) + 1 } }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 2) throw error; }
    }
    throw new BadRequestException("Could not allocate artifact version");
  }
  async generateDisplayDraft(flowId: string, nodeId: string, prompt: string) { const sourceCode = await this.llm.generate("Return only one self-contained HTML document. It must use a form and submit via parent.postMessage({ type: 'flowos:display-submit', values: Object.fromEntries(new FormData(form)) }, '*'). Never use fetch, cookies, localStorage, or top navigation.", prompt, { maxTokens: 3000 }); return this.createDraft(flowId, nodeId, "display", sourceCode.replace(/^```html\s*|```$/g, "")); }
  list(flowId: string) { return this.prisma.artifact.findMany({ where: { flowId }, orderBy: { version: "desc" } }); }
  published(flowId: string, nodeId: string, kind = "display") { return this.prisma.artifact.findFirst({ where: { flowId, nodeId, kind: this.kind(kind), isPublished: true }, orderBy: { version: "desc" } }); }
  async publish(id: string) { const artifact = await this.prisma.artifact.findUnique({ where: { id } }); if (!artifact) throw new NotFoundException(`Artifact ${id} not found`); return this.prisma.$transaction(async (tx) => { await tx.artifact.updateMany({ where: { flowId: artifact.flowId, nodeId: artifact.nodeId, kind: artifact.kind }, data: { isPublished: false } }); return tx.artifact.update({ where: { id }, data: { isPublished: true, status: "published" } }); }); }
}
