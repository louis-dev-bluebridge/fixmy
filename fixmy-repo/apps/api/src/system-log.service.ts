import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "./prisma.service";

export type SystemLogLevel = "INFO" | "WARN" | "ERROR";

@Injectable()
export class SystemLogService {
  constructor(private readonly db: PrismaService) {}

  async record(input: { level: SystemLogLevel; source: string; message: string; stack?: string; method?: string; path?: string; statusCode?: number; requestId?: string; actorId?: string; metadata?: Record<string, unknown> }) {
    try {
      return await this.db.systemLog.create({ data: { id: randomUUID(), level: input.level, source: input.source, message: input.message.slice(0, 2000), stack: input.stack?.slice(0, 12000), method: input.method, path: input.path, statusCode: input.statusCode, requestId: input.requestId, actorId: input.actorId, metadata: input.metadata as any } });
    } catch (error) {
      console.error(JSON.stringify({ level: "ERROR", source: "system-log", message: "Unable to persist system log", error: String(error) }));
      return null;
    }
  }

  async list(filters: { level?: string; source?: string; path?: string; search?: string; limit?: number; offset?: number } = {}) {
    const search = filters.search?.trim();
    const where = {
      level: filters.level || undefined,
      source: filters.source || undefined,
      path: filters.path ? { contains: filters.path, mode: "insensitive" as const } : undefined,
      OR: search ? [{ message: { contains: search, mode: "insensitive" as const } }, { requestId: { contains: search, mode: "insensitive" as const } }, { source: { contains: search, mode: "insensitive" as const } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.db.systemLog.findMany({ where, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(filters.limit ?? 100, 1), 500), skip: Math.max(filters.offset ?? 0, 0) }),
      this.db.systemLog.count({ where }),
    ]);
    return { total, items: items.map(item => ({ id: item.id, level: item.level, source: item.source, message: item.message, stack: item.stack ?? undefined, method: item.method ?? undefined, path: item.path ?? undefined, statusCode: item.statusCode ?? undefined, requestId: item.requestId ?? undefined, actorId: item.actorId ?? undefined, metadata: item.metadata ?? undefined, createdAt: item.createdAt.toISOString() })) };
  }

  async summary() {
    const [errors, warnings, recent] = await Promise.all([
      this.db.systemLog.count({ where: { level: "ERROR" } }),
      this.db.systemLog.count({ where: { level: "WARN" } }),
      this.db.systemLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
    return { errors, warnings, recent: recent.map(item => ({ level: item.level, source: item.source, message: item.message, createdAt: item.createdAt.toISOString() })) };
  }
}
