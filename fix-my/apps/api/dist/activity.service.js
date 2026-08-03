"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
let ActivityService = class ActivityService {
    db;
    constructor(db) {
        this.db = db;
    }
    record(input) {
        return this.db.activityLog.create({
            data: {
                actorId: input.actorId,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                summary: input.summary,
                metadata: input.metadata,
            },
        });
    }
    async list(filters = {}) {
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
};
exports.ActivityService = ActivityService;
exports.ActivityService = ActivityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ActivityService);
