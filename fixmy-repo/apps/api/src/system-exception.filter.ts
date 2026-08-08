import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { SystemLogService } from "./system-log.service";

@Catch()
export class SystemExceptionFilter implements ExceptionFilter {
  constructor(private readonly logs: SystemLogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<any>();
    const response = context.getResponse<any>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = String(request.headers?.["x-request-id"] ?? randomUUID());
    const payload = exception instanceof HttpException ? exception.getResponse() : { message: "Internal server error" };
    const message = exception instanceof Error ? exception.message : String(exception);
    const actorId = request.user?.id as string | undefined;
    const level = statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";
    void this.logs.record({ level, source: "api", message, stack: statusCode >= 500 && exception instanceof Error ? exception.stack : undefined, method: request.method, path: request.url, statusCode, requestId, actorId, metadata: { ip: request.ip, userAgent: request.headers?.["user-agent"] } });
    console.error(JSON.stringify({ level, source: "api", requestId, method: request.method, path: request.url, statusCode, message }));
    response.header("x-request-id", requestId).status(statusCode).send(typeof payload === "string" ? { statusCode, message: payload, requestId } : { ...(payload as object), requestId });
  }
}
