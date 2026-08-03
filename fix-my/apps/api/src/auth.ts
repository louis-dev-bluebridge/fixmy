import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { SessionUser, UserRole } from "@fixmy/contracts";
import { PrismaService } from "./prisma.service";

export const Public = () => SetMetadata("public", true);
export const AllowPasswordChange = () => SetMetadata("allowPasswordChange", true);
export const Roles = (...roles: UserRole[]) => SetMetadata("roles", roles);
export const CurrentUser = createParamDecorator((_data, context) => context.switchToHttp().getRequest().user as SessionUser);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector, private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>("public", [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest();
    const token = String(request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Authentication required");
    try { request.user = this.jwt.verify(token); } catch { throw new UnauthorizedException("Invalid session"); }
    const current = await this.db.user.findUnique({ where: { id: request.user.id }, select: { status: true, mustChangePassword: true, role: true } });
    if (!current || current.status !== "ACTIVE") throw new ForbiddenException(current?.status === "SUSPENDED" ? "Account suspended" : "Account unavailable");
    request.user = { ...request.user, role: current.role, status: current.status, mustChangePassword: current.mustChangePassword };
    const allowPasswordChange = this.reflector.getAllAndOverride<boolean>("allowPasswordChange", [context.getHandler(), context.getClass()]);
    if (current.mustChangePassword && !allowPasswordChange) throw new ForbiddenException("PASSWORD_CHANGE_REQUIRED");
    const roles = this.reflector.getAllAndOverride<UserRole[]>("roles", [context.getHandler(), context.getClass()]);
    if (roles?.length && !roles.includes(request.user.role)) throw new ForbiddenException("Role not allowed");
    return true;
  }
}
