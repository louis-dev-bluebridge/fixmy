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
exports.AuthGuard = exports.CurrentUser = exports.Roles = exports.AllowPasswordChange = exports.Public = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("./prisma.service");
const Public = () => (0, common_1.SetMetadata)("public", true);
exports.Public = Public;
const AllowPasswordChange = () => (0, common_1.SetMetadata)("allowPasswordChange", true);
exports.AllowPasswordChange = AllowPasswordChange;
const Roles = (...roles) => (0, common_1.SetMetadata)("roles", roles);
exports.Roles = Roles;
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, context) => context.switchToHttp().getRequest().user);
let AuthGuard = class AuthGuard {
    jwt;
    reflector;
    db;
    constructor(jwt, reflector, db) {
        this.jwt = jwt;
        this.reflector = reflector;
        this.db = db;
    }
    async canActivate(context) {
        if (this.reflector.getAllAndOverride("public", [context.getHandler(), context.getClass()]))
            return true;
        const request = context.switchToHttp().getRequest();
        const token = String(request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
        if (!token)
            throw new common_1.UnauthorizedException("Authentication required");
        try {
            request.user = this.jwt.verify(token);
        }
        catch {
            throw new common_1.UnauthorizedException("Invalid session");
        }
        const current = await this.db.user.findUnique({ where: { id: request.user.id }, select: { status: true, mustChangePassword: true, role: true } });
        if (!current || current.status !== "ACTIVE")
            throw new common_1.ForbiddenException(current?.status === "SUSPENDED" ? "Account suspended" : "Account unavailable");
        request.user = { ...request.user, role: current.role, status: current.status, mustChangePassword: current.mustChangePassword };
        const allowPasswordChange = this.reflector.getAllAndOverride("allowPasswordChange", [context.getHandler(), context.getClass()]);
        if (current.mustChangePassword && !allowPasswordChange)
            throw new common_1.ForbiddenException("PASSWORD_CHANGE_REQUIRED");
        const roles = this.reflector.getAllAndOverride("roles", [context.getHandler(), context.getClass()]);
        if (roles?.length && !roles.includes(request.user.role))
            throw new common_1.ForbiddenException("Role not allowed");
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService, core_1.Reflector, prisma_service_1.PrismaService])
], AuthGuard);
