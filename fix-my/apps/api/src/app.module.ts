import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthGuard } from "./auth";
import { JobGateway } from "./job.gateway";
import { PrismaService } from "./prisma.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { CredentialVaultService } from "./credential-vault.service";
import { ActivityService } from "./activity.service";

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET ?? "local-development-secret-change-before-deploy", signOptions: { expiresIn: "12h" } })],
  controllers: [AppController, PaymentsController],
  providers: [AppService, PaymentsService, CredentialVaultService, ActivityService, JobGateway, PrismaService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
