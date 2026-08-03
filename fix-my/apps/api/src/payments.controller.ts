import { Body, Controller, Get, Headers, Param, Patch, Post, Req } from "@nestjs/common";
import type { PaymentProviderType, SessionUser } from "@fixmy/contracts";
import { CurrentUser, Public, Roles } from "./auth";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Roles("CLIENT") @Get("methods") methods() { return this.payments.methods(); }
  @Roles("CLIENT") @Post("checkout") checkout(@CurrentUser() user: SessionUser, @Body() body: { jobId: string; providerId: string; method: string; idempotencyKey?: string }) { return this.payments.checkout(user, body); }
  @Roles("CLIENT") @Post(":id/mock-confirm") confirmMock(@CurrentUser() user: SessionUser, @Param("id") id: string, @Body() body: { outcome: "success" | "failure" }) { return this.payments.confirmMock(user, id, body.outcome); }
  @Public() @Post("webhooks/stripe") stripeWebhook(@Headers("stripe-signature") signature: string | undefined, @Req() request: { rawBody?: Buffer }) { return this.payments.handleStripeWebhook(signature, request.rawBody ?? Buffer.alloc(0)); }

  @Roles("ADMIN") @Get("admin/providers") providers() { return this.payments.providers(); }
  @Roles("ADMIN") @Post("admin/providers") saveProvider(@Body() body: { id?: string; type: PaymentProviderType; name: string; supportedMethods: string[]; mode?: string; publicKey?: string; credentials?: Record<string, string>; isActive?: boolean; priority?: number }) { return this.payments.saveProvider(body); }
  @Roles("ADMIN") @Patch("admin/providers/:id") updateProvider(@Param("id") id: string, @Body() body: { type: PaymentProviderType; name: string; supportedMethods: string[]; mode?: string; publicKey?: string; credentials?: Record<string, string>; isActive?: boolean; priority?: number }) { return this.payments.saveProvider({ ...body, id }); }
  @Roles("ADMIN") @Post("admin/providers/:id/test") testProvider(@Param("id") id: string) { return this.payments.testProvider(id); }
  @Roles("ADMIN") @Get("admin/transactions") transactions() { return this.payments.adminPayments(); }
  @Roles("ADMIN") @Post("admin/transactions/:id/refund") refund(@CurrentUser() user: SessionUser, @Param("id") id: string, @Body() body: { amountCents?: number; reason?: string }) { return this.payments.refund(user, id, body); }
}
