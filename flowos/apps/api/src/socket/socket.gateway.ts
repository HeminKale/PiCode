import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: "*" } })
export class SocketGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage("join_run")
  handleJoinRun(@MessageBody() data: { runId: string }, @ConnectedSocket() client: Socket) {
    client.join(`run:${data.runId}`);
  }

  emitNodeStatus(runId: string, payload: { nodeId: string; status: string; outputs?: unknown; error?: string }) {
    this.server.to(`run:${runId}`).emit("node:status", payload);
  }

  emitRunComplete(runId: string, payload: { status: string }) {
    this.server.to(`run:${runId}`).emit("run:complete", payload);
  }

  emitRunError(runId: string, payload: { message: string }) {
    this.server.to(`run:${runId}`).emit("run:error", payload);
  }
}
