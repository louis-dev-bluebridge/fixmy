import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { JobStatus, SessionUser, UserRole, UserStatus } from "@fixmy/contracts";
import { AppService } from "./app.service";
import { AllowPasswordChange, AuthGuard, CurrentUser, Public, Roles } from "./auth";
import { SystemLogService } from "./system-log.service";

@Controller()
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AppController {
  constructor(private readonly service: AppService, private readonly systemLogs: SystemLogService) {}

  @Public() @Get("/health") health() { return this.service.health(); }
  @Public() @ApiTags("catalog") @Get("/categories") categories() { return this.service.categories(); }
  @Public() @ApiTags("catalog") @Get("/categories/:id/pros") categoryPros(@Param("id") id: string, @Query("lat") lat?: string, @Query("lng") lng?: string) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    return this.service.categoryPros(id, Number.isFinite(latitude) ? latitude : undefined, Number.isFinite(longitude) ? longitude : undefined);
  }

  @Public() @ApiTags("auth") @Post("/auth/register/client") registerClient(@Body() body: { name: string; email: string; password: string }) { return this.service.registerClient(body); }
  @Public() @ApiTags("auth") @Post("/auth/register/pro") registerPro(@Body() body: { name: string; email: string; password: string; profession: string; categoryId: string }) { return this.service.registerPro(body); }
  @Public() @ApiTags("auth") @Post("/auth/login") login(@Body() body: { email: string; password: string }) { return this.service.login(body); }
  @AllowPasswordChange() @ApiTags("auth") @Get("/auth/me") me(@CurrentUser() user: SessionUser) { return this.service.me(user.id); }
  @AllowPasswordChange() @ApiTags("auth") @Post("/auth/change-password") changePassword(@CurrentUser() user: SessionUser, @Body() body: { currentPassword: string; newPassword: string }) { return this.service.changePassword(user, body); }

  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/dashboard") adminDashboard() { return this.service.adminDashboard(); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/activity") adminActivity(@Query("actorId") actorId?: string, @Query("entityType") entityType?: string, @Query("entityId") entityId?: string, @Query("action") action?: string, @Query("limit") limit?: string) { return this.service.adminActivity({ actorId, entityType, entityId, action, limit: limit ? Number(limit) : undefined }); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/system-logs") adminSystemLogs(@Query("level") level?: string, @Query("source") source?: string, @Query("path") path?: string, @Query("search") search?: string, @Query("limit") limit?: string, @Query("offset") offset?: string) { return this.systemLogs.list({ level, source, path, search, limit: limit ? Number(limit) : undefined, offset: offset ? Number(offset) : undefined }); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/system-logs/summary") adminSystemLogSummary() { return this.systemLogs.summary(); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/users") adminUsers(@Query("role") role?: UserRole, @Query("status") status?: UserStatus, @Query("search") search?: string) { return this.service.adminUsers({ role, status, search }); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/users/:id") adminUser(@Param("id") id: string) { return this.service.adminUserDetail(id); }
  @Roles("ADMIN") @ApiTags("admin") @Patch("/admin/users/:id") updateAdminUser(@CurrentUser() actor: SessionUser, @Param("id") id: string, @Body() body: { name?: string; email?: string; phone?: string }) { return this.service.updateAdminUser(actor, id, body); }
  @Roles("ADMIN") @ApiTags("admin") @Patch("/admin/users/:id/status") updateAdminUserStatus(@CurrentUser() actor: SessionUser, @Param("id") id: string, @Body() body: { status: "ACTIVE" | "SUSPENDED" }) { return this.service.updateAdminUserStatus(actor, id, body.status); }
  @Roles("ADMIN") @ApiTags("admin") @Post("/admin/users/:id/reset-password") resetAdminUserPassword(@CurrentUser() actor: SessionUser, @Param("id") id: string) { return this.service.resetUserPassword(actor, id); }
  @Roles("ADMIN") @ApiTags("admin") @Delete("/admin/users/:id") deleteAdminUser(@CurrentUser() actor: SessionUser, @Param("id") id: string) { return this.service.softDeleteUser(actor, id); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/pros") pros() { return this.service.pendingPros(); }
  @Roles("ADMIN") @ApiTags("admin") @Patch("/admin/pros/:id/approval") approve(@CurrentUser() actor: SessionUser, @Param("id") id: string, @Body() body: { status: "APPROVED" | "REJECTED" }) { return this.service.approvePro(actor, id, body.status); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/services") adminServices() { return this.service.adminServices(); }
  @Roles("ADMIN") @ApiTags("admin") @Post("/admin/services") createAdminService(@CurrentUser() actor: SessionUser, @Body() body: { slug: string; icon: string; names: { es: string; fr: string; nl: string; en: string; pt: string }; description: string; isActive?: boolean }) { return this.service.saveAdminService(actor, body); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/services/:id") adminService(@Param("id") id: string) { return this.service.adminServiceDetail(id); }
  @Roles("ADMIN") @ApiTags("admin") @Patch("/admin/services/:id") updateAdminService(@CurrentUser() actor: SessionUser, @Param("id") id: string, @Body() body: { slug: string; icon: string; names: { es: string; fr: string; nl: string; en: string; pt: string }; description: string; isActive?: boolean }) { return this.service.saveAdminService(actor, { ...body, id }); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/jobs") adminJobs(@Query("status") status?: string, @Query("search") search?: string) { return this.service.adminJobs({ status, search }); }
  @Roles("ADMIN") @ApiTags("admin") @Get("/admin/jobs/:id") adminJob(@Param("id") id: string) { return this.service.adminJobDetail(id); }
  @Roles("ADMIN") @ApiTags("admin") @Post("/admin/jobs/:id/cancel") cancelAdminJob(@CurrentUser() actor: SessionUser, @Param("id") id: string, @Body() body: { reason?: string }) { return this.service.cancelJobAdmin(actor, id, body.reason); }

  @Roles("PRO") @ApiTags("pro") @Get("/pro/dashboard") proDashboard(@CurrentUser() user: SessionUser) { return this.service.proDashboard(user); }
  @Roles("PRO") @ApiTags("pro") @Patch("/pro/profile") updateProProfile(@CurrentUser() user: SessionUser, @Body() body: { name?: string; profession?: string; bio?: string; businessName?: string; phone?: string; vatNumber?: string; serviceArea?: string; serviceRadiusKm?: number; hourlyRateCents?: number; yearsExperience?: number }) { return this.service.updateProProfile(user, body); }
  @Roles("PRO") @ApiTags("pro") @Patch("/pro/availability") updateProAvailability(@CurrentUser() user: SessionUser, @Body() body: { isOnline: boolean }) { return this.service.updateProAvailability(user, body.isOnline); }
  @Roles("PRO") @ApiTags("pro") @Post("/pro/services") addProService(@CurrentUser() user: SessionUser, @Body() body: { categoryId: string }) { return this.service.addProService(user, body.categoryId); }
  @Roles("PRO") @ApiTags("pro") @Patch("/pro/services") replaceProServices(@CurrentUser() user: SessionUser, @Body() body: { categoryIds: string[] }) { return this.service.replaceProServices(user, body.categoryIds); }

  @Roles("CLIENT") @ApiTags("jobs") @Post("/jobs") createJob(@CurrentUser() user: SessionUser, @Body() body: { categoryId: string; title: string; description: string; address: string; budgetCents: number; lat: number; lng: number }) { return this.service.createJob(user, body); }
  @Roles("CLIENT", "PRO") @ApiTags("jobs") @Get("/jobs/mine") mine(@CurrentUser() user: SessionUser) { return this.service.mine(user); }
  @Roles("PRO") @ApiTags("jobs") @Get("/jobs/available") available(@CurrentUser() user: SessionUser) { return this.service.available(user); }
  @Roles("PRO") @ApiTags("jobs") @Post("/jobs/:id/accept") accept(@CurrentUser() user: SessionUser, @Param("id") id: string) { return this.service.accept(user, id); }
  @Roles("PRO") @ApiTags("jobs") @Patch("/jobs/:id/status") updateStatus(@CurrentUser() user: SessionUser, @Param("id") id: string, @Body() body: { status: JobStatus }) { return this.service.updateStatus(user, id, body.status); }
  @Roles("CLIENT", "PRO", "ADMIN") @ApiTags("jobs") @Get("/jobs/:id") getJob(@CurrentUser() user: SessionUser, @Param("id") id: string) { return this.service.getJobForUser(user, id); }
}
