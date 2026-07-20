import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Flow, FlowEdge, FlowNode, NodeLog } from "@flowos/types";
import { PrismaService } from "../prisma/prisma.service";
import { SocketGateway } from "../socket/socket.gateway";
import { ExecutionContext } from "./execution-context";
import { ConnectorsService } from "../connectors/connectors.service";
import { JavaClassNotLoadedError, JavaRuntimeService } from "../java-runtime/java-runtime.service";
import { LLMService } from "../llm/llm.service";
import { GENERATE_JAVA_CLASS_SYSTEM_PROMPT } from "../java-runtime/generate-java-class.prompt";

interface NodeExecutionResult {
  outputs: Record<string, unknown>;
  /** Set only by CONDITION — the resolved outcome name, used to pick which outgoing edge to follow. */
  branch?: string;
}

interface LoopContinuation { forNodeId: string; bodyTarget: string; exitTarget?: string; itemVar: string; items: unknown[]; index: number; }
class AwaitingInputError extends Error { loop?: LoopContinuation; constructor(readonly nodeId: string) { super("Flow is awaiting DISPLAY input"); } }

@Injectable()
export class ExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
    private readonly connectors: ConnectorsService,
    private readonly javaRuntime: JavaRuntimeService,
    private readonly llm: LLMService,
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
    void this.run(flow, runId);

    return { runId };
  }

  async resumeRun(runId: string, values: Record<string, unknown>): Promise<{ runId: string }> {
    const run = await this.getRun(runId);
    if (run.status !== "awaiting_input") throw new NotFoundException(`Run ${runId} is not awaiting input`);
    const flow = (await this.prisma.flow.findUniqueOrThrow({ where: { id: run.flowId } })).flowJson as unknown as Flow;
    const saved = run.inputs as Record<string, unknown>;
    const nodeId = saved.__flowosResumeNodeId as string;
    const display = flow.nodes.find((node) => node.id === nodeId && node.type === "DISPLAY");
    if (!display) throw new BadRequestException("Run continuation does not reference a DISPLAY node");
    const allowed = new Set(((display.config as { fields?: Array<{ variable: string }> }).fields ?? []).map((field) => field.variable));
    const invalid = Object.keys(values).filter((key) => !allowed.has(key));
    if (invalid.length) throw new BadRequestException(`Unexpected DISPLAY input fields: ${invalid.join(", ")}`);
    const context = { ...saved, ...Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key))) };
    delete context.__flowosResumeNodeId;
    delete context.__flowosLoopState;
    await this.prisma.flowRun.update({ where: { id: runId }, data: { status: "running", inputs: context as object } });
    void this.run(flow, runId, context, nodeId, run.nodeLogs as unknown as NodeLog[], saved.__flowosLoopState as LoopContinuation | undefined);
    return { runId };
  }

  private async run(flow: Flow, runId: string, initial: Record<string, unknown> = {}, resumeNodeId?: string, priorLogs: NodeLog[] = [], loopState?: LoopContinuation): Promise<void> {
    const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
    const outgoing = new Map<string, FlowEdge[]>();
    const incoming = new Map<string, number>();
    for (const n of flow.nodes) {
      outgoing.set(n.id, []);
      incoming.set(n.id, 0);
    }
    for (const e of flow.edges) {
      outgoing.get(e.source)?.push(e);
      incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
    }

    // Entry points: nodes nothing points to. Falls back to the first declared node
    // if every node has an incoming edge (e.g. a flow that's entirely a cycle).
    const roots = flow.nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0);
    const startNodes = resumeNodeId ? (outgoing.get(resumeNodeId) ?? []).map((edge) => nodeById.get(edge.target)).filter((node): node is FlowNode => !!node) : roots.length ? roots : flow.nodes.slice(0, 1);

    const context = new ExecutionContext(initial);
    const nodeLogs: NodeLog[] = [...priorLogs];
    const visited = new Set<string>();

    try {
      if (loopState) {
        visited.add(loopState.forNodeId);
        const resumeEdges = outgoing.get(resumeNodeId!) ?? [];
        for (const edge of resumeEdges) await this.walk(edge.target, nodeById, outgoing, context, visited, nodeLogs, runId);
        for (let index = loopState.index + 1; index < loopState.items.length; index++) {
          context.set(loopState.itemVar, loopState.items[index]);
          try {
            await this.walk(loopState.bodyTarget, nodeById, outgoing, context, new Set<string>([loopState.forNodeId]), nodeLogs, runId);
          } catch (err) {
            if (err instanceof AwaitingInputError && !err.loop) {
              err.loop = { ...loopState, index };
            }
            throw err;
          }
        }
        if (loopState.exitTarget) await this.walk(loopState.exitTarget, nodeById, outgoing, context, visited, nodeLogs, runId);
      } else {
      for (const root of startNodes) {
        await this.walk(root.id, nodeById, outgoing, context, visited, nodeLogs, runId);
      }
      }

      await this.prisma.flowRun.update({
        where: { id: runId },
        data: { status: "completed", endedAt: new Date(), nodeLogs: nodeLogs as object[] },
      });
      this.socket.emitRunComplete(runId, { status: "completed" });
    } catch (err) {
      if (err instanceof AwaitingInputError) {
        const saved = { ...context.snapshot(), __flowosResumeNodeId: err.nodeId, ...(err.loop ? { __flowosLoopState: err.loop } : {}) };
        await this.prisma.flowRun.update({ where: { id: runId }, data: { status: "awaiting_input", inputs: saved as object, nodeLogs: nodeLogs as object[] } });
        return;
      }
      await this.prisma.flowRun.update({
        where: { id: runId },
        data: { status: "failed", endedAt: new Date(), nodeLogs: nodeLogs as object[] },
      });
      this.socket.emitRunError(runId, { message: err instanceof Error ? err.message : "Unknown execution error" });
    }
  }

  /**
   * Walks the flow graph from `nodeId`, executing each node and following only the
   * edges that should actually run: a CONDITION only follows its resolved outcome's
   * edge, and a FOR re-walks its "For Each" body once per item (with a fresh `visited`
   * set per iteration, seeded with the FOR node itself so the loop-back edge terminates)
   * before continuing down "After Last". Everything else fans out to all outgoing edges.
   */
  private async walk(
    nodeId: string,
    nodeById: Map<string, FlowNode>,
    outgoing: Map<string, FlowEdge[]>,
    context: ExecutionContext,
    visited: Set<string>,
    nodeLogs: NodeLog[],
    runId: string,
  ): Promise<void> {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeById.get(nodeId);
    if (!node) return;

    const { branch } = await this.executeAndLog(node, context, nodeLogs, runId);
    const edges = outgoing.get(nodeId) ?? [];

    if (node.type === "CONDITION") {
      const matchEdge = edges.find((e) => e.label === branch);
      if (matchEdge) await this.walk(matchEdge.target, nodeById, outgoing, context, visited, nodeLogs, runId);
      return;
    }

    if (node.type === "FOR") {
      const config = node.config as { iterateVar: string; itemVar: string };
      const items = context.get<unknown[]>(config.iterateVar);
      const bodyEdge = edges.find((e) => e.label === "For Each");
      const exitEdge = edges.find((e) => e.label === "After Last");

      if (bodyEdge && Array.isArray(items)) {
        for (let index = 0; index < items.length; index++) {
          const item = items[index];
          context.set(config.itemVar, item);
          const loopVisited = new Set<string>([nodeId]);
          try { await this.walk(bodyEdge.target, nodeById, outgoing, context, loopVisited, nodeLogs, runId); }
          catch (err) { if (err instanceof AwaitingInputError && !err.loop) err.loop = { forNodeId: nodeId, bodyTarget: bodyEdge.target, exitTarget: exitEdge?.target, itemVar: config.itemVar, items, index }; throw err; }
        }
      }
      if (exitEdge) await this.walk(exitEdge.target, nodeById, outgoing, context, visited, nodeLogs, runId);
      return;
    }

    for (const edge of edges) {
      await this.walk(edge.target, nodeById, outgoing, context, visited, nodeLogs, runId);
    }
  }

  private async executeAndLog(
    node: FlowNode,
    context: ExecutionContext,
    nodeLogs: NodeLog[],
    runId: string,
  ): Promise<NodeExecutionResult> {
    const startedAt = new Date().toISOString();
    this.socket.emitNodeStatus(runId, { nodeId: node.id, status: "pending" });
    this.socket.emitNodeStatus(runId, { nodeId: node.id, status: "running" });

    try {
      const result = await this.executeNode(node, context);
      const endedAt = new Date().toISOString();

      nodeLogs.push({
        nodeId: node.id,
        status: "success",
        startedAt,
        endedAt,
        inputs: context.snapshot(),
        outputs: result.outputs,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      });
      this.socket.emitNodeStatus(runId, { nodeId: node.id, status: "success", outputs: result.outputs });
      return result;
    } catch (err) {
      if (err instanceof AwaitingInputError) {
        nodeLogs.push({ nodeId: node.id, status: "awaiting_input", startedAt, inputs: context.snapshot(), outputs: {}, durationMs: Date.now() - new Date(startedAt).getTime() });
        this.socket.emitNodeStatus(runId, { nodeId: node.id, status: "awaiting_input" });
        throw err;
      }
      const endedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : "Unknown node error";
      nodeLogs.push({
        nodeId: node.id,
        status: "error",
        startedAt,
        endedAt,
        inputs: context.snapshot(),
        outputs: {},
        error: message,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      });
      this.socket.emitNodeStatus(runId, { nodeId: node.id, status: "error" });
      throw err;
    }
  }

  /** A field value that names an existing context variable resolves to that variable; otherwise it's used literally. */
  private resolveValue(context: ExecutionContext, value: unknown): unknown {
    if (typeof value === "string" && context.get(value) !== undefined) return context.get(value);
    return value;
  }

  private resolveFields(context: ExecutionContext, fields: Record<string, unknown> = {}): Record<string, unknown> {
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, this.resolveValue(context, v)]));
  }

  private async executeNode(node: FlowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const config = node.config as Record<string, any>;
    let result: unknown;
    let branch: string | undefined;

    switch (node.type) {
      case "SOURCE":
        context.set("__activeConnectorId", config.connectorId);
        result = { connectorId: config.connectorId };
        break;
      case "SELECT": {
        const connectionString = await this.connectors.resolveConnectionString(context.get("__activeConnectorId"));
        result = await this.connectors.select(config.query ?? `SELECT * FROM ${config.source}`, [], connectionString);
        break;
      }
      case "CREATE": {
        const connectionString = await this.connectors.resolveConnectionString(context.get("__activeConnectorId"));
        result = await this.connectors.insert(config.target, this.resolveFields(context, config.fields), connectionString);
        break;
      }
      case "UPDATE": {
        const connectionString = await this.connectors.resolveConnectionString(context.get("__activeConnectorId"));
        result = await this.connectors.update(config.target, config.where, this.resolveFields(context, config.fields), connectionString);
        break;
      }
      case "DELETE": {
        const connectionString = await this.connectors.resolveConnectionString(context.get("__activeConnectorId"));
        result = await this.connectors.remove(config.target, config.where, connectionString);
        break;
      }
      case "ASSIGN":
        for (const assignment of config.assignments ?? []) {
          const current = context.get<any>(assignment.variable);
          const value = this.resolveValue(context, assignment.value);
          const next =
            assignment.operator === "Add"
              ? Number(current ?? 0) + Number(value)
              : assignment.operator === "Subtract"
                ? Number(current ?? 0) - Number(value)
                : assignment.operator === "AddItemToList"
                  ? [...(Array.isArray(current) ? current : []), value]
                  : assignment.operator === "RemoveItemFromList"
                    ? Array.isArray(current)
                      ? current.filter((item) => item !== value)
                      : []
                    : value;
          context.set(assignment.variable, next);
        }
        result = context.snapshot();
        break;
      case "CONDITION": {
        const match = (config.outcomes ?? []).find((outcome: any) =>
          (outcome.conditions ?? []).every((condition: any) =>
            this.compare(context.get(condition.resource), condition.operator, condition.value),
          ),
        );
        branch = match?.name ?? config.defaultOutcomeName;
        result = { outcome: branch };
        break;
      }
      case "FOR":
        result = { items: context.get(config.iterateVar) ?? [], itemVar: config.itemVar };
        break;
      case "DISPLAY":
        throw new AwaitingInputError(node.id);
      case "CALL_JAVA": {
        const inputVars: string[] = config.inputVars ?? [];
        const input = Object.fromEntries(inputVars.map((name) => [name, context.get(name)]));
        result = await this.callJava(config.className, config.method, input);
        break;
      }
      case "RULE":
        result = { matched: (config.conditions ?? []).every((condition: any) => this.compare(context.get(condition.field), condition.op, condition.value)) };
        break;
      case "NOTIFY":
        result = { delivered: false, reason: "No notification provider configured", channel: config.channel };
        break;
      case "AUDIT_LOG":
        result = { event: config.event, data: config.dataVars?.map((name: string) => context.get(name)) };
        break;
      default:
        result = Object.fromEntries(node.outputs.map((name) => [name, context.get(name)]));
    }

    const outputs = node.outputs.length ? Object.fromEntries(node.outputs.map((name) => [name, result])) : { result };
    Object.entries(outputs).forEach(([name, value]) => context.set(name, value));
    return { outputs, branch };
  }

  /**
   * Calls a CALL_JAVA node's target method via the Java Runtime. If the class isn't loaded yet
   * (signaled by JavaClassNotLoadedError, raised on a 404 from the runtime's execute endpoint),
   * generates a compilable Java source for it via the LLM, hot-loads it, and retries once.
   */
  private async callJava(className: string, method: string, input: Record<string, unknown>): Promise<unknown> {
    try {
      return await this.javaRuntime.executeClass(className, method, input);
    } catch (err) {
      if (!(err instanceof JavaClassNotLoadedError)) throw err;

      const userPrompt = `Class name: ${className}\nMethod name: ${method}\nInput keys available in the "input" map: ${Object.keys(input).join(", ") || "(none)"}`;
      const raw = await this.llm.generate(GENERATE_JAVA_CLASS_SYSTEM_PROMPT, userPrompt, { maxTokens: 2000 });
      const sourceCode = raw.replace(/^```(?:java)?\s*/i, "").replace(/```\s*$/i, "").trim();

      await this.javaRuntime.loadClass(className, sourceCode);
      return this.javaRuntime.executeClass(className, method, input);
    }
  }

  private compare(actual: any, operator: string, expected: any): boolean {
    if (operator === "Equals" || operator === "=") return actual === expected;
    if (operator === "NotEquals" || operator === "!=") return actual !== expected;
    if (operator === "GreaterThan" || operator === ">") return Number(actual) > Number(expected);
    if (operator === "LessThan" || operator === "<") return Number(actual) < Number(expected);
    if (operator === "Contains") return Array.isArray(actual) ? actual.includes(expected) : String(actual).includes(String(expected));
    return false;
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
