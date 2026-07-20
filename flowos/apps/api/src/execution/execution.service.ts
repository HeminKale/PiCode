import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Flow, NodeLog } from "@flowos/types";
import { PrismaService } from "../prisma/prisma.service";
import { SocketGateway } from "../socket/socket.gateway";
import { topologicalSort } from "./topological-sort";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class ExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
  ) {}

  async startRun(flowId: string): Promise<{ runId: string }> {
    const flowRecord = await this.prisma.flow.findUnique({ where: { id: flowId } });
    if (!flowRecord) throw new NotFoundException(`Flow ${flowId} not found`);

    const flow = flowRecord.flowJson as unknown as Flow;
    const runId = randomUUID();

    await this.prisma.flowRun.create({
      data: { id: runId, flowId, status: "running", inputs: {}, nodeLogs: [] },
    });

    // Fire and forget — the HTTP response returns immediately with the runId,
    // the frontend joins the Socket.io room for that runId and watches it play out.
    void this.runMock(flow, runId);

    return { runId };
  }

  private async runMock(flow: Flow, runId: string): Promise<void> {
    const ordered = topologicalSort(flow.nodes, flow.edges);
    const nodeLogs: NodeLog[] = [];

    try {
      for (const node of ordered) {
        const startedAt = new Date().toISOString();
        this.socket.emitNodeStatus(runId, { nodeId: node.id, status: "pending" });
        await sleep(800);

        this.socket.emitNodeStatus(runId, { nodeId: node.id, status: "running" });
        await sleep(600);

        const mockOutputs = Object.fromEntries(node.outputs.map((o) => [o, `<mock ${o}>`]));
        const endedAt = new Date().toISOString();

        nodeLogs.push({
          nodeId: node.id,
          status: "success",
          startedAt,
          endedAt,
          inputs: node.config,
          outputs: mockOutputs,
          durationMs: 1400,
        });

        this.socket.emitNodeStatus(runId, { nodeId: node.id, status: "success", outputs: mockOutputs });
      }

      await this.prisma.flowRun.update({
        where: { id: runId },
        data: { status: "completed", endedAt: new Date(), nodeLogs: nodeLogs as object[] },
      });
      this.socket.emitRunComplete(runId, { status: "completed" });
    } catch (err) {
      await this.prisma.flowRun.update({
        where: { id: runId },
        data: { status: "failed", endedAt: new Date(), nodeLogs: nodeLogs as object[] },
      });
      this.socket.emitRunError(runId, { message: err instanceof Error ? err.message : "Unknown execution error" });
    }
  }

  async getRun(runId: string) {
    const run = await this.prisma.flowRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    return run;
  }

  async listRunsForFlow(flowId: string) {
    return this.prisma.flowRun.findMany({
      where: { flowId },
      orderBy: { startedAt: "desc" },
    });
  }
}
