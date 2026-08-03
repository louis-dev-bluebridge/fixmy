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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_service_1 = require("./app.service");
const auth_1 = require("./auth");
let AppController = class AppController {
    service;
    constructor(service) {
        this.service = service;
    }
    health() { return this.service.health(); }
    categories() { return this.service.categories(); }
    categoryPros(id, lat, lng) {
        const latitude = Number(lat);
        const longitude = Number(lng);
        return this.service.categoryPros(id, Number.isFinite(latitude) ? latitude : undefined, Number.isFinite(longitude) ? longitude : undefined);
    }
    registerClient(body) { return this.service.registerClient(body); }
    registerPro(body) { return this.service.registerPro(body); }
    login(body) { return this.service.login(body); }
    me(user) { return this.service.me(user.id); }
    changePassword(user, body) { return this.service.changePassword(user, body); }
    adminDashboard() { return this.service.adminDashboard(); }
    adminActivity(actorId, entityType, entityId, action, limit) { return this.service.adminActivity({ actorId, entityType, entityId, action, limit: limit ? Number(limit) : undefined }); }
    adminUsers(role, status, search) { return this.service.adminUsers({ role, status, search }); }
    adminUser(id) { return this.service.adminUserDetail(id); }
    updateAdminUser(actor, id, body) { return this.service.updateAdminUser(actor, id, body); }
    updateAdminUserStatus(actor, id, body) { return this.service.updateAdminUserStatus(actor, id, body.status); }
    resetAdminUserPassword(actor, id) { return this.service.resetUserPassword(actor, id); }
    deleteAdminUser(actor, id) { return this.service.softDeleteUser(actor, id); }
    pros() { return this.service.pendingPros(); }
    approve(actor, id, body) { return this.service.approvePro(actor, id, body.status); }
    adminServices() { return this.service.adminServices(); }
    createAdminService(actor, body) { return this.service.saveAdminService(actor, body); }
    adminService(id) { return this.service.adminServiceDetail(id); }
    updateAdminService(actor, id, body) { return this.service.saveAdminService(actor, { ...body, id }); }
    adminJobs(status, search) { return this.service.adminJobs({ status, search }); }
    adminJob(id) { return this.service.adminJobDetail(id); }
    cancelAdminJob(actor, id, body) { return this.service.cancelJobAdmin(actor, id, body.reason); }
    proDashboard(user) { return this.service.proDashboard(user); }
    updateProProfile(user, body) { return this.service.updateProProfile(user, body); }
    updateProAvailability(user, body) { return this.service.updateProAvailability(user, body.isOnline); }
    addProService(user, body) { return this.service.addProService(user, body.categoryId); }
    replaceProServices(user, body) { return this.service.replaceProServices(user, body.categoryIds); }
    createJob(user, body) { return this.service.createJob(user, body); }
    mine(user) { return this.service.mine(user); }
    available(user) { return this.service.available(user); }
    accept(user, id) { return this.service.accept(user, id); }
    updateStatus(user, id, body) { return this.service.updateStatus(user, id, body.status); }
    getJob(user, id) { return this.service.getJobForUser(user, id); }
};
exports.AppController = AppController;
__decorate([
    (0, auth_1.Public)(),
    (0, common_1.Get)("/health"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "health", null);
__decorate([
    (0, auth_1.Public)(),
    (0, swagger_1.ApiTags)("catalog"),
    (0, common_1.Get)("/categories"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "categories", null);
__decorate([
    (0, auth_1.Public)(),
    (0, swagger_1.ApiTags)("catalog"),
    (0, common_1.Get)("/categories/:id/pros"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)("lat")),
    __param(2, (0, common_1.Query)("lng")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "categoryPros", null);
__decorate([
    (0, auth_1.Public)(),
    (0, swagger_1.ApiTags)("auth"),
    (0, common_1.Post)("/auth/register/client"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "registerClient", null);
__decorate([
    (0, auth_1.Public)(),
    (0, swagger_1.ApiTags)("auth"),
    (0, common_1.Post)("/auth/register/pro"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "registerPro", null);
__decorate([
    (0, auth_1.Public)(),
    (0, swagger_1.ApiTags)("auth"),
    (0, common_1.Post)("/auth/login"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "login", null);
__decorate([
    (0, auth_1.AllowPasswordChange)(),
    (0, swagger_1.ApiTags)("auth"),
    (0, common_1.Get)("/auth/me"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "me", null);
__decorate([
    (0, auth_1.AllowPasswordChange)(),
    (0, swagger_1.ApiTags)("auth"),
    (0, common_1.Post)("/auth/change-password"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "changePassword", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Get)("/admin/dashboard"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "adminDashboard", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Get)("/admin/activity"),
    __param(0, (0, common_1.Query)("actorId")),
    __param(1, (0, common_1.Query)("entityType")),
    __param(2, (0, common_1.Query)("entityId")),
    __param(3, (0, common_1.Query)("action")),
    __param(4, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "adminActivity", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Get)("/admin/users"),
    __param(0, (0, common_1.Query)("role")),
    __param(1, (0, common_1.Query)("status")),
    __param(2, (0, common_1.Query)("search")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "adminUsers", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Get)("/admin/users/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "adminUser", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Patch)("/admin/users/:id"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateAdminUser", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Patch)("/admin/users/:id/status"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateAdminUserStatus", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Post)("/admin/users/:id/reset-password"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "resetAdminUserPassword", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Delete)("/admin/users/:id"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "deleteAdminUser", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Get)("/admin/pros"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "pros", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Patch)("/admin/pros/:id/approval"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "approve", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Get)("/admin/services"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "adminServices", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Post)("/admin/services"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "createAdminService", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Get)("/admin/services/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "adminService", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Patch)("/admin/services/:id"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateAdminService", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Get)("/admin/jobs"),
    __param(0, (0, common_1.Query)("status")),
    __param(1, (0, common_1.Query)("search")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "adminJobs", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Get)("/admin/jobs/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "adminJob", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Post)("/admin/jobs/:id/cancel"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "cancelAdminJob", null);
__decorate([
    (0, auth_1.Roles)("PRO"),
    (0, swagger_1.ApiTags)("pro"),
    (0, common_1.Get)("/pro/dashboard"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "proDashboard", null);
__decorate([
    (0, auth_1.Roles)("PRO"),
    (0, swagger_1.ApiTags)("pro"),
    (0, common_1.Patch)("/pro/profile"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateProProfile", null);
__decorate([
    (0, auth_1.Roles)("PRO"),
    (0, swagger_1.ApiTags)("pro"),
    (0, common_1.Patch)("/pro/availability"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateProAvailability", null);
__decorate([
    (0, auth_1.Roles)("PRO"),
    (0, swagger_1.ApiTags)("pro"),
    (0, common_1.Post)("/pro/services"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "addProService", null);
__decorate([
    (0, auth_1.Roles)("PRO"),
    (0, swagger_1.ApiTags)("pro"),
    (0, common_1.Patch)("/pro/services"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "replaceProServices", null);
__decorate([
    (0, auth_1.Roles)("CLIENT"),
    (0, swagger_1.ApiTags)("jobs"),
    (0, common_1.Post)("/jobs"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "createJob", null);
__decorate([
    (0, auth_1.Roles)("CLIENT", "PRO"),
    (0, swagger_1.ApiTags)("jobs"),
    (0, common_1.Get)("/jobs/mine"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "mine", null);
__decorate([
    (0, auth_1.Roles)("PRO"),
    (0, swagger_1.ApiTags)("jobs"),
    (0, common_1.Get)("/jobs/available"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "available", null);
__decorate([
    (0, auth_1.Roles)("PRO"),
    (0, swagger_1.ApiTags)("jobs"),
    (0, common_1.Post)("/jobs/:id/accept"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "accept", null);
__decorate([
    (0, auth_1.Roles)("PRO"),
    (0, swagger_1.ApiTags)("jobs"),
    (0, common_1.Patch)("/jobs/:id/status"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateStatus", null);
__decorate([
    (0, auth_1.Roles)("CLIENT", "PRO", "ADMIN"),
    (0, swagger_1.ApiTags)("jobs"),
    (0, common_1.Get)("/jobs/:id"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getJob", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(auth_1.AuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [app_service_1.AppService])
], AppController);
