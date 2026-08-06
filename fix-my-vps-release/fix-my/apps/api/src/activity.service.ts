import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Injectable()
export class ActivityService {
  constructor(private readonly db: PrismaService) {}

  record(input: { actorId?: string; action: string; entityType: string; entityId: string; summary: string; metadata?: Record<string, unknown> }) {
    return this.db.activityLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadata: input.metadata as any,
      },
    });
  }

  async list(filters: { actorId?: string; entityType?: string; entityId?: string; action?: string; limit?: number } = {}) {
    const rows = await this.db.activityLog.findMany({
      where: {
        actorId: filters.actorId || undefined,
        entityType: filters.entityType || undefined,
        entityId: filters.entityId || undefined,
        action: filters.action || undefined,
      },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 500),
    });
    return rows.map((row) => ({
      id: row.id,
      actor: row.actor ? { id: row.actor.id, name: row.actor.name, role: row.actor.role } : undefined,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      metadata: row.metadata ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
