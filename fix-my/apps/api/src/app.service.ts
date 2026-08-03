import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { JobStatus, SessionUser, UserRole, UserStatus } from "@fixmy/contracts";
import { PrismaService } from "./prisma.service";
import { JobGateway } from "./job.gateway";
import { ActivityService } from "./activity.service";

@Injectable()
export class AppService {
  constructor(private readonly db: PrismaService, private readonly jwt: JwtService, private readonly gateway: JobGateway, private readonly activity: ActivityService) {}

  async categories() {
    const rows = await this.db.serviceCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            proServices: {
              where: { pro: { approvalStatus: "APPROVED" } },
            },
          },
        },
      },
      orderBy: { nameEs: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      icon: row.icon,
      names: { es: row.nameEs, fr: row.nameFr, nl: row.nameNl, en: row.nameEn, pt: row.namePt },
      description: row.description,
      activePros: row._count.proServices,
    }));
  }

  async categoryPros(categoryId: string, lat = 50.8467, lng = 4.3525) {
    const category = await this.db.serviceCategory.findFirst({
      where: { id: categoryId, isActive: true },
    });
    if (!category) throw new NotFoundException("Category not found");

    const services = await this.db.proService.findMany({
      where: {
        categoryId,
        pro: {
          approvalStatus: "APPROVED",
          user: { status: "ACTIVE" },
        },
      },
      include: { pro: { include: { user: true } } },
    });

    return services
      .map(({ pro }) => ({
        id: pro.userId,
        name: pro.user.name,
        profession: pro.profession,
        category: category.nameEs,
        bio: pro.bio ?? undefined,
        rating: Number(pro.rating),
        completedJobs: pro.completedJobs,
        distanceKm: this.distanceKm(lat, lng, pro.latitude, pro.longitude),
        isOnline: pro.isOnline,
        status: pro.approvalStatus,
      }))
      .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.distanceKm - b.distanceKm || b.rating - a.rating);
  }

  async registerClient(input: { name: string; email: string; password: string }) {
    await this.ensureUniqueEmail(input.email);
    const user = await this.db.user.create({ data: { name: input.name, email: input.email.toLowerCase(), passwordHash: await hash(input.password, 12), role: "CLIENT", client: { create: {} } } });
    return this.authResponse(user);
  }

  async registerPro(input: { name: string; email: string; password: string; profession: string; categoryId: string }) {
    await this.ensureUniqueEmail(input.email);
    const category = await this.db.serviceCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundException("Category not found");
    const user = await this.db.user.create({ data: { name: input.name, email: input.email.toLowerCase(), passwordHash: await hash(input.password, 12), role: "PRO", pro: { create: { profession: input.profession, services: { create: { categoryId: input.categoryId } } } } }, include: { pro: true } });
    return this.authResponse(user);
  }

  async login(input: { email: string; password: string }) {
    const user = await this.db.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { pro: true } });
    if (!user || !(await compare(input.password, user.passwordHash))) throw new UnauthorizedException("Invalid credentials");
    if (user.status === "SUSPENDED") throw new ForbiddenException("Account suspended");
    if (user.status === "DELETED") throw new ForbiddenException("Account unavailable");
    return this.authResponse(user);
  }

  async me(id: string) {
    const user = await this.db.user.findUnique({ where: { id }, include: { pro: true } });
    if (!user) throw new UnauthorizedException();
    return this.sessionUser(user);
  }

  async pendingPros() {
    const users = await this.db.user.findMany({ where: { role: "PRO", status: { not: "DELETED" } }, include: { pro: { include: { services: { include: { category: true } }, assignedJobs: { include: { payments: true } } } } }, orderBy: { createdAt: "desc" } });
    return users.map((user) => {
      const completed = user.pro?.assignedJobs.filter((job) => job.status === "COMPLETED") ?? [];
      return { id: user.id, name: user.name, email: user.email, phone: user.pro?.phone ?? user.phone ?? undefined, profession: user.pro?.profession ?? "Fixer", businessName: user.pro?.businessName ?? undefined, bio: user.pro?.bio ?? undefined, vatNumber: user.pro?.vatNumber ?? undefined, serviceArea: user.pro?.serviceArea ?? "Brussels", serviceRadiusKm: user.pro?.serviceRadiusKm ?? 25, hourlyRateCents: user.pro?.hourlyRateCents ?? undefined, yearsExperience: user.pro?.yearsExperience ?? 0, services: user.pro?.services.map((service) => ({ id: service.category.id, name: service.category.nameEs, slug: service.category.slug })) ?? [], category: user.pro?.services[0]?.category.nameEs, rating: Number(user.pro?.rating ?? 5), completedJobs: completed.length, totalEarnedCents: completed.reduce((total, job) => total + job.budgetCents, 0), isOnline: user.pro?.isOnline ?? false, userStatus: user.status, status: user.pro?.approvalStatus ?? "PENDING", createdAt: user.createdAt.toISOString() };
    });
  }

  async approvePro(actor: SessionUser, id: string, status: "APPROVED" | "REJECTED") {
    if (!(["APPROVED", "REJECTED"] as string[]).includes(status)) throw new ConflictException("Invalid approval status");
    const pro = await this.db.proProfile.update({ where: { userId: id }, data: { approvalStatus: status, isOnline: status === "APPROVED" ? undefined : false }, include: { user: true } });
    await this.activity.record({ actorId: actor.id, action: status === "APPROVED" ? "PRO_APPROVED" : "PRO_REJECTED", entityType: "USER", entityId: id, summary: `${actor.name} ${status === "APPROVED" ? "aprobó" : "rechazó"} a ${pro.user.name}`, metadata: { status } });
    return pro;
  }

  async adminJobs(filters: { status?: string; search?: string } = {}) {
    const jobs = await this.db.job.findMany({ where: { status: filters.status as any || undefined, OR: filters.search ? [{ title: { contains: filters.search, mode: "insensitive" } }, { address: { contains: filters.search, mode: "insensitive" } }] : undefined }, include: this.jobInclude(), orderBy: { createdAt: "desc" } });
    return jobs.map((job) => this.mapJob(job));
  }

  async adminDashboard() {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [users, clients, pros, pendingPros, services, jobs, payments, refunds, recentActivity] = await Promise.all([
      this.db.user.count({ where: { status: { not: "DELETED" } } }),
      this.db.user.count({ where: { role: "CLIENT", status: "ACTIVE" } }),
      this.db.user.count({ where: { role: "PRO", status: "ACTIVE" } }),
      this.db.proProfile.count({ where: { approvalStatus: "PENDING", user: { status: "ACTIVE" } } }),
      this.db.serviceCategory.count({ where: { isActive: true } }),
      this.db.job.groupBy({ by: ["status"], _count: { _all: true } }),
      this.db.payment.aggregate({ where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { amountCents: true }, _count: { _all: true } }),
      this.db.refund.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true }, _count: { _all: true } }),
      this.activity.list({ limit: 12 }),
    ]);
    return { users, clients, pros, pendingPros, services, jobs: Object.fromEntries(jobs.map((row) => [row.status, row._count._all])), payments: { count: payments._count._all, volumeCents: payments._sum.amountCents ?? 0 }, refunds: { count: refunds._count._all, volumeCents: refunds._sum.amountCents ?? 0 }, recentActivity, monthStart: monthStart.toISOString() };
  }

  adminActivity(filters: { actorId?: string; entityType?: string; entityId?: string; action?: string; limit?: number }) { return this.activity.list(filters); }

  async adminUsers(filters: { role?: UserRole; status?: UserStatus; search?: string } = {}) {
    const users = await this.db.user.findMany({ where: { role: filters.role, status: filters.status, OR: filters.search ? [{ name: { contains: filters.search, mode: "insensitive" } }, { email: { contains: filters.search, mode: "insensitive" } }] : undefined }, include: { pro: true, _count: { select: { jobs: true } } }, orderBy: { createdAt: "desc" } });
    const totals = await Promise.all(users.map(async (user) => {
      const [spent, earned] = await Promise.all([this.db.payment.aggregate({ where: { job: { clientId: user.id }, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { amountCents: true } }), this.db.job.aggregate({ where: { assignedProId: user.id, status: "COMPLETED" }, _sum: { budgetCents: true } })]);
      return { id: user.id, name: user.name, email: user.email, phone: user.phone ?? undefined, role: user.role, status: user.status, proStatus: user.pro?.approvalStatus, mustChangePassword: user.mustChangePassword, createdAt: user.createdAt.toISOString(), jobsCount: user._count.jobs, totalSpentCents: spent._sum.amountCents ?? 0, totalEarnedCents: earned._sum.budgetCents ?? 0 };
    }));
    return totals;
  }

  async adminUserDetail(id: string) {
    const user = await this.db.user.findUnique({ where: { id }, include: { pro: { include: { services: { include: { category: true } }, assignedJobs: { include: this.jobInclude() } } }, jobs: { include: this.jobInclude(), orderBy: { createdAt: "desc" } }, refunds: { include: { payment: { include: { provider: true, job: true } } }, orderBy: { createdAt: "desc" } } } });
    if (!user) throw new NotFoundException("User not found");
    const activities = await this.activity.list({ entityType: "USER", entityId: id, limit: 100 });
    return { user: { id: user.id, name: user.name, email: user.email, phone: user.phone ?? undefined, role: user.role, status: user.status, mustChangePassword: user.mustChangePassword, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() }, pro: user.pro ? { profession: user.pro.profession, businessName: user.pro.businessName, bio: user.pro.bio, phone: user.pro.phone, vatNumber: user.pro.vatNumber, serviceArea: user.pro.serviceArea, serviceRadiusKm: user.pro.serviceRadiusKm, hourlyRateCents: user.pro.hourlyRateCents, yearsExperience: user.pro.yearsExperience, approvalStatus: user.pro.approvalStatus, rating: Number(user.pro.rating), completedJobs: user.pro.completedJobs, isOnline: user.pro.isOnline, services: user.pro.services.map((service) => ({ id: service.category.id, name: service.category.nameEs })) } : undefined, jobs: user.role === "CLIENT" ? user.jobs.map((job) => this.mapJob(job)) : user.pro?.assignedJobs.map((job) => this.mapJob(job)) ?? [], refunds: user.refunds, activities };
  }

  async updateAdminUser(actor: SessionUser, id: string, input: { name?: string; email?: string; phone?: string }) {
    const user = await this.db.user.update({ where: { id }, data: { name: input.name?.trim() || undefined, email: input.email?.trim().toLowerCase() || undefined, phone: input.phone?.trim() || null } });
    await this.activity.record({ actorId: actor.id, action: "USER_UPDATED", entityType: "USER", entityId: id, summary: `${actor.name} actualizó el perfil de ${user.name}` });
    return this.adminUserDetail(id);
  }

  async updateAdminUserStatus(actor: SessionUser, id: string, status: "ACTIVE" | "SUSPENDED") {
    if (id === actor.id) throw new ConflictException("You cannot suspend your own account");
    const user = await this.db.user.update({ where: { id }, data: { status } });
    if (status === "SUSPENDED" && user.role === "PRO") await this.db.proProfile.update({ where: { userId: id }, data: { isOnline: false } });
    await this.activity.record({ actorId: actor.id, action: status === "ACTIVE" ? "USER_REACTIVATED" : "USER_SUSPENDED", entityType: "USER", entityId: id, summary: `${actor.name} ${status === "ACTIVE" ? "reactivó" : "suspendió"} a ${user.name}` });
    return this.adminUserDetail(id);
  }

  async resetUserPassword(actor: SessionUser, id: string) {
    const temporaryPassword = `Fix${randomBytes(5).toString("hex")}!`;
    const user = await this.db.user.update({ where: { id }, data: { passwordHash: await hash(temporaryPassword, 12), mustChangePassword: true, status: "ACTIVE" } });
    await this.activity.record({ actorId: actor.id, action: "PASSWORD_RESET", entityType: "USER", entityId: id, summary: `${actor.name} restableció la contraseña de ${user.name}` });
    return { temporaryPassword, mustChangePassword: true };
  }

  async softDeleteUser(actor: SessionUser, id: string) {
    if (id === actor.id) throw new ConflictException("You cannot delete your own account");
    const user = await this.db.user.update({ where: { id }, data: { status: "DELETED", deletedAt: new Date() } });
    if (user.role === "PRO") await this.db.proProfile.update({ where: { userId: id }, data: { isOnline: false } });
    await this.activity.record({ actorId: actor.id, action: "USER_DELETED", entityType: "USER", entityId: id, summary: `${actor.name} eliminó lógicamente a ${user.name}` });
    return { success: true };
  }

  async changePassword(user: SessionUser, input: { currentPassword: string; newPassword: string }) {
    if (!input.newPassword || input.newPassword.length < 8) throw new ConflictException("New password must have at least 8 characters");
    const account = await this.db.user.findUnique({ where: { id: user.id } });
    if (!account || !(await compare(input.currentPassword, account.passwordHash))) throw new UnauthorizedException("Current password is invalid");
    await this.db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(input.newPassword, 12), mustChangePassword: false } });
    return { success: true };
  }

  async adminServices() {
    const services = await this.db.serviceCategory.findMany({ include: { proServices: { include: { pro: true } }, jobs: true }, orderBy: { nameEs: "asc" } });
    return services.map((service) => { const completed = service.jobs.filter((job) => job.status === "COMPLETED"); return { id: service.id, slug: service.slug, icon: service.icon, names: { es: service.nameEs, fr: service.nameFr, nl: service.nameNl, en: service.nameEn, pt: service.namePt }, description: service.description, activePros: service.proServices.filter((link) => link.pro.approvalStatus === "APPROVED").length, approvedPros: service.proServices.filter((link) => link.pro.approvalStatus === "APPROVED").length, pendingPros: service.proServices.filter((link) => link.pro.approvalStatus === "PENDING").length, jobsCount: service.jobs.length, completedJobs: completed.length, revenueCents: completed.reduce((total, job) => total + job.budgetCents, 0), isActive: service.isActive } });
  }

  async adminServiceDetail(id: string) {
    const service = await this.db.serviceCategory.findUnique({ where: { id }, include: { proServices: { include: { pro: { include: { user: true } } } }, jobs: { include: this.jobInclude(), orderBy: { createdAt: "desc" } } } });
    if (!service) throw new NotFoundException("Service not found");
    return { service: { id: service.id, slug: service.slug, icon: service.icon, names: { es: service.nameEs, fr: service.nameFr, nl: service.nameNl, en: service.nameEn, pt: service.namePt }, description: service.description, isActive: service.isActive }, pros: service.proServices.map(({ pro }) => ({ id: pro.userId, name: pro.user.name, email: pro.user.email, profession: pro.profession, status: pro.approvalStatus, userStatus: pro.user.status, isOnline: pro.isOnline, rating: Number(pro.rating), completedJobs: pro.completedJobs })), jobs: service.jobs.map((job) => this.mapJob(job)) };
  }

  async saveAdminService(actor: SessionUser, input: { id?: string; slug: string; icon: string; names: { es: string; fr: string; nl: string; en: string; pt: string }; description: string; isActive?: boolean }) {
    if (!input.slug?.trim() || !input.names?.es?.trim()) throw new ConflictException("Slug and Spanish name are required");
    const data = { slug: input.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), icon: input.icon?.trim() || "Wrench", nameEs: input.names.es.trim(), nameFr: input.names.fr?.trim() || input.names.es.trim(), nameNl: input.names.nl?.trim() || input.names.es.trim(), nameEn: input.names.en?.trim() || input.names.es.trim(), namePt: input.names.pt?.trim() || input.names.es.trim(), description: input.description?.trim() || input.names.es.trim(), isActive: input.isActive ?? true };
    const service = input.id ? await this.db.serviceCategory.update({ where: { id: input.id }, data }) : await this.db.serviceCategory.create({ data });
    await this.activity.record({ actorId: actor.id, action: input.id ? "SERVICE_UPDATED" : "SERVICE_CREATED", entityType: "SERVICE", entityId: service.id, summary: `${actor.name} ${input.id ? "actualizó" : "creó"} el servicio ${service.nameEs}` });
    return this.adminServiceDetail(service.id);
  }

  async adminJobDetail(id: string) {
    const job = await this.db.job.findUnique({ where: { id }, include: { ...this.jobInclude(), history: { include: { actor: true }, orderBy: { createdAt: "asc" } }, payments: { include: { provider: true, events: true, refunds: true }, orderBy: { createdAt: "desc" } } } });
    if (!job) throw new NotFoundException("Job not found");
    return { job: this.mapJob(job), history: job.history.map((item) => ({ id: item.id, status: item.status, actor: { id: item.actor.id, name: item.actor.name, role: item.actor.role }, createdAt: item.createdAt.toISOString() })), payments: job.payments };
  }

  async cancelJobAdmin(actor: SessionUser, id: string, reason?: string) {
    const job = await this.db.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Job not found");
    if (["COMPLETED", "CANCELLED"].includes(job.status)) throw new ConflictException("This job cannot be cancelled");
    await this.db.$transaction([this.db.job.update({ where: { id }, data: { status: "CANCELLED" } }), this.db.jobHistory.create({ data: { jobId: id, actorId: actor.id, status: "CANCELLED" } })]);
    await this.activity.record({ actorId: actor.id, action: "JOB_CANCELLED", entityType: "JOB", entityId: id, summary: `${actor.name} canceló el trabajo ${job.title}`, metadata: { reason: reason ?? "Admin cancellation" } });
    return this.adminJobDetail(id);
  }

  async proDashboard(user: SessionUser) {
    const pro = await this.db.proProfile.findUnique({
      where: { userId: user.id },
      include: { user: true, services: { include: { category: true } } },
    });
    if (!pro) throw new NotFoundException("Pro profile not found");
    const categoryIds = pro.services.map((service) => service.categoryId);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [availableJobs, activeJobs, completedJobs] = await Promise.all([
      pro.approvalStatus === "APPROVED" && categoryIds.length
        ? this.db.job.count({ where: { status: "OPEN", categoryId: { in: categoryIds } } })
        : 0,
      this.db.job.findMany({
        where: { assignedProId: user.id, status: { in: ["ASSIGNED", "PRO_EN_ROUTE", "IN_PROGRESS"] } },
        select: { id: true },
      }),
      this.db.job.findMany({
        where: { assignedProId: user.id, status: "COMPLETED" },
        select: { budgetCents: true, updatedAt: true },
      }),
    ]);
    return {
      profile: {
        id: pro.userId,
        name: pro.user.name,
        email: pro.user.email,
        profession: pro.profession,
        bio: pro.bio ?? undefined,
        businessName: pro.businessName ?? undefined,
        phone: pro.phone ?? pro.user.phone ?? undefined,
        vatNumber: pro.vatNumber ?? undefined,
        serviceArea: pro.serviceArea,
        serviceRadiusKm: pro.serviceRadiusKm,
        hourlyRateCents: pro.hourlyRateCents ?? undefined,
        yearsExperience: pro.yearsExperience,
        approvalStatus: pro.approvalStatus,
        rating: Number(pro.rating),
        completedJobs: pro.completedJobs,
        isOnline: pro.isOnline,
      },
      services: pro.services.map(({ category }) => ({
        categoryId: category.id,
        slug: category.slug,
        icon: category.icon,
        name: category.nameEs,
        description: category.description,
      })),
      metrics: {
        availableJobs,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
        totalEarnedCents: completedJobs.reduce((total, job) => total + job.budgetCents, 0),
        monthEarnedCents: completedJobs.filter((job) => job.updatedAt >= monthStart).reduce((total, job) => total + job.budgetCents, 0),
      },
    };
  }

  async updateProProfile(user: SessionUser, input: { name?: string; profession?: string; bio?: string; businessName?: string; phone?: string; vatNumber?: string; serviceArea?: string; serviceRadiusKm?: number; hourlyRateCents?: number; yearsExperience?: number }) {
    if (input.serviceRadiusKm !== undefined && (!Number.isInteger(input.serviceRadiusKm) || input.serviceRadiusKm < 1 || input.serviceRadiusKm > 150)) throw new ConflictException("Service radius must be between 1 and 150 km");
    if (input.hourlyRateCents !== undefined && (!Number.isInteger(input.hourlyRateCents) || input.hourlyRateCents < 0 || input.hourlyRateCents > 100000)) throw new ConflictException("Hourly rate is invalid");
    if (input.yearsExperience !== undefined && (!Number.isInteger(input.yearsExperience) || input.yearsExperience < 0 || input.yearsExperience > 80)) throw new ConflictException("Years of experience are invalid");
    await this.db.$transaction([
      this.db.user.update({ where: { id: user.id }, data: { name: input.name?.trim() || undefined, phone: input.phone?.trim() || undefined } }),
      this.db.proProfile.update({
        where: { userId: user.id },
        data: {
          profession: input.profession?.trim() || undefined,
          bio: input.bio?.trim() || null,
          businessName: input.businessName?.trim() || null,
          phone: input.phone?.trim() || null,
          vatNumber: input.vatNumber?.trim() || null,
          serviceArea: input.serviceArea?.trim() || undefined,
          serviceRadiusKm: input.serviceRadiusKm,
          hourlyRateCents: input.hourlyRateCents,
          yearsExperience: input.yearsExperience,
        },
      }),
    ]);
    return this.proDashboard(user);
  }

  async updateProAvailability(user: SessionUser, isOnline: boolean) {
    const pro = await this.db.proProfile.findUnique({ where: { userId: user.id } });
    if (!pro) throw new NotFoundException("Pro profile not found");
    if (isOnline && pro.approvalStatus !== "APPROVED") throw new ForbiddenException("Approval is required before going online");
    await this.db.proProfile.update({ where: { userId: user.id }, data: { isOnline: Boolean(isOnline) } });
    return this.proDashboard(user);
  }

  async addProService(user: SessionUser, categoryId: string) {
    const category = await this.db.serviceCategory.findFirst({ where: { id: categoryId, isActive: true } });
    if (!category) throw new NotFoundException("Category not found");
    await this.db.proService.upsert({ where: { proId_categoryId: { proId: user.id, categoryId } }, update: {}, create: { proId: user.id, categoryId } });
    return this.proDashboard(user);
  }

  async replaceProServices(user: SessionUser, categoryIds: string[]) {
    const uniqueIds = [...new Set(categoryIds.filter(Boolean))];
    if (!uniqueIds.length) throw new ConflictException("Select at least one service");
    const activeCount = await this.db.serviceCategory.count({ where: { id: { in: uniqueIds }, isActive: true } });
    if (activeCount !== uniqueIds.length) throw new ConflictException("One or more services are invalid");
    await this.db.$transaction([
      this.db.proService.deleteMany({ where: { proId: user.id, categoryId: { notIn: uniqueIds } } }),
      ...uniqueIds.map((categoryId) => this.db.proService.upsert({ where: { proId_categoryId: { proId: user.id, categoryId } }, update: {}, create: { proId: user.id, categoryId } })),
    ]);
    return this.proDashboard(user);
  }

  async createJob(user: SessionUser, input: { categoryId: string; title: string; description: string; address: string; budgetCents: number; lat: number; lng: number }) {
    if (!input.categoryId || !input.title?.trim() || !input.description?.trim() || !input.address?.trim()) throw new ConflictException("Complete all service details");
    if (!Number.isInteger(input.budgetCents) || input.budgetCents < 1000 || input.budgetCents > 1000000) throw new ConflictException("Budget must be between €10 and €10,000");
    const job = await this.db.job.create({ data: { clientId: user.id, categoryId: input.categoryId, title: input.title.trim(), description: input.description.trim(), address: input.address.trim(), budgetCents: input.budgetCents, latitude: input.lat, longitude: input.lng, status: "DRAFT", history: { create: { actorId: user.id, status: "DRAFT" } } }, include: this.jobInclude() });
    await this.setJobPoint(job.id, input.lat, input.lng);
    return this.mapJob(job);
  }

  async mine(user: SessionUser) {
    const where = user.role === "CLIENT" ? { clientId: user.id } : { assignedProId: user.id };
    const jobs = await this.db.job.findMany({ where, include: this.jobInclude(), orderBy: { createdAt: "desc" } });
    return jobs.map(job => this.mapJob(job));
  }

  async available(user: SessionUser) {
    const pro = await this.db.proProfile.findUnique({ where: { userId: user.id }, include: { services: true } });
    if (!pro || pro.approvalStatus !== "APPROVED") throw new ForbiddenException("Your Pro account must be approved first");
    const categoryIds = pro.services.map(item => item.categoryId);
    const jobs = await this.db.job.findMany({ where: { status: "OPEN", categoryId: { in: categoryIds } }, include: this.jobInclude(), orderBy: { createdAt: "desc" } });
    return jobs.map(job => this.mapJob(job));
  }

  async accept(user: SessionUser, id: string) {
    const pro = await this.db.proProfile.findUnique({ where: { userId: user.id } });
    if (!pro || pro.approvalStatus !== "APPROVED") throw new ForbiddenException("Pro approval required");
    const result = await this.db.job.updateMany({ where: { id, status: "OPEN", assignedProId: null }, data: { assignedProId: user.id, status: "ASSIGNED", etaMinutes: 18 } });
    if (result.count !== 1) throw new ConflictException("This job is no longer available");
    await this.db.jobHistory.create({ data: { jobId: id, actorId: user.id, status: "ASSIGNED" } });
    const job = await this.getJobForUser(user, id);
    this.gateway.publish(job);
    return job;
  }

  async updateStatus(user: SessionUser, id: string, status: JobStatus) {
    const job = await this.db.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Job not found");
    if (job.assignedProId !== user.id) throw new ForbiddenException("Only assigned Pro can update this job");
    const transitions: Record<JobStatus, JobStatus[]> = { DRAFT: [], PAYMENT_PENDING: [], PAYMENT_FAILED: [], OPEN: [], ASSIGNED: ["PRO_EN_ROUTE"], PRO_EN_ROUTE: ["IN_PROGRESS"], IN_PROGRESS: ["COMPLETED"], COMPLETED: [], CANCELLED: [] };
    if (!transitions[job.status].includes(status)) throw new ConflictException(`Invalid transition ${job.status} -> ${status}`);
    await this.db.job.update({ where: { id }, data: { status, etaMinutes: status === "PRO_EN_ROUTE" ? 12 : status === "COMPLETED" ? 0 : job.etaMinutes } });
    await this.db.jobHistory.create({ data: { jobId: id, actorId: user.id, status } });
    if (status === "COMPLETED") await this.db.proProfile.update({ where: { userId: user.id }, data: { completedJobs: { increment: 1 } } });
    const updated = await this.getJobForUser(user, id);
    this.gateway.publish(updated);
    return updated;
  }

  async getJobForUser(user: SessionUser, id: string) {
    const job = await this.db.job.findUnique({ where: { id }, include: this.jobInclude() });
    if (!job) throw new NotFoundException("Job not found");
    if (user.role !== "ADMIN" && job.clientId !== user.id && job.assignedProId !== user.id) throw new ForbiddenException();
    return this.mapJob(job);
  }

  async health() { await this.db.$queryRaw`SELECT 1`; return { status: "ok", database: "connected", service: "fix-my-api", timestamp: new Date().toISOString() }; }

  private async ensureUniqueEmail(email: string) { if (await this.db.user.findUnique({ where: { email: email.toLowerCase() } })) throw new ConflictException("Email already registered"); }
  private sessionUser(user: any): SessionUser { return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, proStatus: user.pro?.approvalStatus, mustChangePassword: user.mustChangePassword }; }
  private authResponse(user: any) { const session = this.sessionUser(user); return { token: this.jwt.sign(session), user: session }; }
  private jobInclude() { return { category: true, client: true, assignedPro: { include: { user: true } }, payments: { include: { provider: true }, orderBy: { createdAt: "desc" as const }, take: 1 } } as const; }
  private mapJob(job: any) { const payment = job.payments?.[0]; return { id: job.id, categoryId: job.categoryId, category: job.category.nameEs, title: job.title, description: job.description, address: job.address, budgetCents: job.budgetCents, currency: job.currency, status: job.status, etaMinutes: job.etaMinutes ?? 0, location: { lat: job.latitude, lng: job.longitude }, client: { id: job.client.id, name: job.client.name }, pro: job.assignedPro ? { id: job.assignedPro.userId, name: job.assignedPro.user.name, profession: job.assignedPro.profession, rating: Number(job.assignedPro.rating), completedJobs: job.assignedPro.completedJobs, distanceKm: 0, isOnline: job.assignedPro.isOnline, status: job.assignedPro.approvalStatus } : undefined, payment: payment ? { id: payment.id, providerId: payment.providerId, providerName: payment.provider.name, providerType: payment.provider.type, method: payment.method, status: payment.status, amountCents: payment.amountCents, currency: payment.currency, externalReference: payment.externalReference ?? undefined, paidAt: payment.paidAt?.toISOString(), createdAt: payment.createdAt.toISOString() } : undefined, createdAt: job.createdAt.toISOString() }; }
  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latDelta = toRadians(lat2 - lat1);
    const lngDelta = toRadians(lng2 - lng1);
    const a = Math.sin(latDelta / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lngDelta / 2) ** 2;
    return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
  }
  private async setJobPoint(id: string, lat: number, lng: number) { await this.db.$executeRaw`UPDATE "Job" SET "servicePoint" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography WHERE "id" = ${id}::uuid`; }
}
