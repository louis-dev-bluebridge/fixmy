import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { JobSummary } from "@fixmy/contracts";
import type { Server } from "socket.io";

@WebSocketGateway({ cors: { origin: "*" } })
export class JobGateway {
  @WebSocketServer()
  server!: Server;

  publish(job: JobSummary) {
    this.server.emit(`job:${job.id}`, job);
  }
}
