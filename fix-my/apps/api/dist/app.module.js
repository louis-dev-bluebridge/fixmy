"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_1 = require("./auth");
const job_gateway_1 = require("./job.gateway");
const prisma_service_1 = require("./prisma.service");
const payments_controller_1 = require("./payments.controller");
const payments_service_1 = require("./payments.service");
const credential_vault_service_1 = require("./credential-vault.service");
const activity_service_1 = require("./activity.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [jwt_1.JwtModule.register({ secret: process.env.JWT_SECRET ?? "local-development-secret-change-before-deploy", signOptions: { expiresIn: "12h" } })],
        controllers: [app_controller_1.AppController, payments_controller_1.PaymentsController],
        providers: [app_service_1.AppService, payments_service_1.PaymentsService, credential_vault_service_1.CredentialVaultService, activity_service_1.ActivityService, job_gateway_1.JobGateway, prisma_service_1.PrismaService, { provide: core_1.APP_GUARD, useClass: auth_1.AuthGuard }],
    })
], AppModule);
