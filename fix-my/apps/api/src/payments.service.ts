import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaymentProviderType, SessionUser } from "@fixmy/contracts";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { PrismaService } from "./prisma.service";
import { CredentialVaultService } from "./credential-vault.service";
import { ActivityService } from "./activity.service";

const METHOD_LABELS: Record<string, string> = {
  mock_card: "Tarjeta de prueba",
  mock_bancontact: "Bancontact de prueba",
  card: "Tarjeta",
  bancontact: "Bancontact",
  paypal: "PayPal",
  payconiq: "Payconiq",
};

@Injectable()
export class PaymentsService {
  constructor(private readonly db: PrismaService, private readonly vault: CredentialVaultService, private readonly activity: ActivityService) {}

  async methods() {
    const providers = await this.db.paymentProvider.findMany({ where: { isActive: true }, orderBy: [{ priority: "desc" }, { name: "asc" }] });
    return providers.flatMap((provider) => provider.supportedMethods.map((method) => ({
      providerId: provider.id,
      providerType: provider.type,
      providerName: provider.name,
      method,
      label: METHOD_LABELS[method] ?? method,
      mode: provider.mode,
      publicKey: provider.publicKey ?? undefined,
    })));
  }

  async providers() {
    const providers = await this.db.paymentProvider.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] });
    return providers.map((provider) => this.mapProvider(provider));
  }

  async saveProvider(input: { id?: string; type: PaymentProviderType; name: string; supportedMethods: string[]; mode?: string; publicKey?: string; credentials?: Record<string, string>; isActive?: boolean; priority?: number }) {
    if (!input.name?.trim() || !input.supportedMethods?.length) throw new BadRequestException("Name and payment methods are required");
    const encryptedCredentials = input.credentials && Object.values(input.credentials).some(Boolean) ? this.vault.encrypt(input.credentials) : undefined;
    const data = { type: input.type, name: input.name.trim(), supportedMethods: input.supportedMethods, mode: input.mode ?? "test", publicKey: input.publicKey || null, isActive: input.isActive ?? false, priority: input.priority ?? 0, ...(encryptedCredentials ? { encryptedCredentials } : {}) };
    const provider = input.id ? await this.db.paymentProvider.update({ where: { id: input.id }, data }) : await this.db.paymentProvider.create({ data });
    return this.mapProvider(provider);
  }

  async testProvider(id: string) {
    const provider = await this.db.paymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException("Payment provider not found");
    const credentials = this.vault.decrypt(provider.encryptedCredentials);
    const succeeds = provider.type === "MOCK" || (provider.type === "STRIPE" && Boolean(credentials.secretKey && provider.publicKey)) || ((provider.type === "PAYPAL" || provider.type === "PAYCONIQ") && Boolean(credentials.clientId && credentials.clientSecret)) || (provider.type === "GENERIC_REST" && Boolean(credentials.baseUrl));
    await this.db.paymentProvider.update({ where: { id }, data: { lastTestedAt: new Date(), lastTestSucceeded: succeeds } });
    return { succeeds, message: succeeds ? "Configuration is ready" : "Required credentials are missing" };
  }

  async checkout(user: SessionUser, input: { jobId: string; providerId: string; method: string; idempotencyKey?: string }) {
    const job = await this.db.job.findUnique({ where: { id: input.jobId }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!job || job.clientId !== user.id) throw new NotFoundException("Job not found");
    if (!["DRAFT", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(job.status)) throw new ConflictException("This job can no longer be paid");
    const provider = await this.db.paymentProvider.findUnique({ where: { id: input.providerId } });
    if (!provider?.isActive || !provider.supportedMethods.includes(input.method)) throw new BadRequestException("Payment method is not available");
    const idempotencyKey = input.idempotencyKey ?? `${job.id}:${provider.id}:${input.method}`;
    const existing = await this.db.payment.findUnique({ where: { idempotencyKey }, include: { provider: true } });
    if (existing) return this.checkoutResponse(existing);
    let externalReference: string | undefined;
    let clientSecret: string | undefined;
    if (provider.type === "STRIPE") {
      const credentials = this.vault.decrypt(provider.encryptedCredentials);
      if (!credentials.secretKey || !provider.publicKey) throw new BadRequestException("Stripe credentials are incomplete");
      const stripe = new Stripe(credentials.secretKey);
      const intent = await stripe.paymentIntents.create({ amount: job.budgetCents, currency: job.currency.toLowerCase(), payment_method_types: [input.method], metadata: { jobId: job.id, clientId: user.id } }, { idempotencyKey });
      externalReference = intent.id;
      clientSecret = intent.client_secret ?? undefined;
    }
    const payment = await this.db.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { status: "PAYMENT_PENDING" } });
      return tx.payment.create({ data: { jobId: job.id, providerId: provider.id, method: input.method, status: provider.type === "MOCK" ? "REQUIRES_ACTION" : "PENDING", amountCents: job.budgetCents, currency: job.currency, idempotencyKey, checkoutReference: randomUUID(), externalReference }, include: { provider: true } });
    });
    return { ...this.checkoutResponse(payment), clientSecret };
  }

  async confirmMock(user: SessionUser, paymentId: string, outcome: "success" | "failure") {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId }, include: { provider: true, job: true } });
    if (!payment || payment.job.clientId !== user.id) throw new NotFoundException("Payment not found");
    if (payment.provider.type !== "MOCK") throw new BadRequestException("Only test payments can be confirmed here");
    if (payment.status === "SUCCEEDED") return this.mapPayment(payment);
    const eventId = `mock:${payment.id}:${outcome}`;
    const updated = await this.db.$transaction(async (tx) => {
      const seen = await tx.paymentEvent.findUnique({ where: { externalEventId: eventId } });
      if (seen) return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { provider: true } });
      await tx.paymentEvent.create({ data: { paymentId: payment.id, externalEventId: eventId, type: outcome === "success" ? "payment.succeeded" : "payment.failed", payload: { source: "local-test" } } });
      const result = await tx.payment.update({ where: { id: payment.id }, data: outcome === "success" ? { status: "SUCCEEDED", paidAt: new Date(), externalReference: `mock_${randomUUID()}` } : { status: "FAILED", failureMessage: "Pago rechazado en modo de prueba" }, include: { provider: true } });
      await tx.job.update({ where: { id: payment.jobId }, data: { status: outcome === "success" ? "OPEN" : "PAYMENT_FAILED" } });
      await tx.jobHistory.create({ data: { jobId: payment.jobId, actorId: user.id, status: outcome === "success" ? "OPEN" : "PAYMENT_FAILED" } });
      return result;
    });
    return this.mapPayment(updated);
  }

  async handleStripeWebhook(signature: string | undefined, rawBody: Buffer) {
    const provider = await this.db.paymentProvider.findFirst({ where: { type: "STRIPE", isActive: true } });
    if (!provider) throw new NotFoundException("Active Stripe provider not found");
    const credentials = this.vault.decrypt(provider.encryptedCredentials);
    if (!credentials.secretKey || !credentials.webhookSecret || !signature) throw new BadRequestException("Stripe webhook is not configured");
    const stripe = new Stripe(credentials.secretKey);
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(rawBody, signature, credentials.webhookSecret); } catch { throw new BadRequestException("Invalid Stripe webhook signature"); }
    const intent = event.data.object as Stripe.PaymentIntent;
    const payment = await this.db.payment.findFirst({ where: { externalReference: intent.id }, include: { job: true } });
    if (!payment) return { received: true, ignored: true };
    const exists = await this.db.paymentEvent.findUnique({ where: { externalEventId: event.id } });
    if (exists) return { received: true, duplicate: true };
    const succeeded = event.type === "payment_intent.succeeded";
    const failed = event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled";
    await this.db.$transaction(async (tx) => {
      await tx.paymentEvent.create({ data: { paymentId: payment.id, externalEventId: event.id, type: event.type, payload: { paymentIntentId: intent.id } } });
      if (succeeded) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", paidAt: new Date() } });
        await tx.job.update({ where: { id: payment.jobId }, data: { status: "OPEN" } });
        await tx.jobHistory.create({ data: { jobId: payment.jobId, actorId: payment.job.clientId, status: "OPEN" } });
      } else if (failed) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureMessage: intent.last_payment_error?.message ?? "Payment failed" } });
        await tx.job.update({ where: { id: payment.jobId }, data: { status: "PAYMENT_FAILED" } });
        await tx.jobHistory.create({ data: { jobId: payment.jobId, actorId: payment.job.clientId, status: "PAYMENT_FAILED" } });
      }
    });
    return { received: true };
  }

  async adminPayments() {
    const payments = await this.db.payment.findMany({ include: { provider: true, job: { include: { client: true } }, refunds: true }, orderBy: { createdAt: "desc" } });
    return payments.map((payment) => ({ ...this.mapPayment(payment), job: { id: payment.job.id, title: payment.job.title, client: payment.job.client.name, status: payment.job.status }, refunds: payment.refunds }));
  }

  async refund(user: SessionUser, paymentId: string, input: { amountCents?: number; reason?: string }) {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId }, include: { provider: true } });
    if (!payment || payment.status !== "SUCCEEDED") throw new ConflictException("Only successful payments can be refunded");
    const amountCents = input.amountCents ?? payment.amountCents;
    if (amountCents <= 0 || amountCents > payment.amountCents) throw new BadRequestException("Invalid refund amount");
    if (payment.provider.type !== "MOCK") throw new BadRequestException("This provider requires its external refund API");
    return this.db.$transaction(async (tx) => {
      const refund = await tx.refund.create({ data: { paymentId, requestedById: user.id, amountCents, reason: input.reason ?? "Admin refund", status: "SUCCEEDED", externalReference: `mock_refund_${randomUUID()}` } });
      await tx.payment.update({ where: { id: paymentId }, data: { status: amountCents === payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
      await tx.activityLog.create({ data: { actorId: user.id, action: "PAYMENT_REFUNDED", entityType: "PAYMENT", entityId: paymentId, summary: `${user.name} reembolsó €${(amountCents / 100).toFixed(2)}`, metadata: { amountCents, reason: input.reason ?? "Admin refund" } } });
      return refund;
    });
  }

  private checkoutResponse(payment: any) { return { payment: this.mapPayment(payment), mode: payment.provider.type === "MOCK" ? "mock" : payment.provider.type === "STRIPE" ? "stripe" : "redirect" }; }
  private mapProvider(provider: any) { return { id: provider.id, type: provider.type, name: provider.name, supportedMethods: provider.supportedMethods, mode: provider.mode, isActive: provider.isActive, priority: provider.priority, publicKey: provider.publicKey ?? undefined, hasCredentials: Boolean(provider.encryptedCredentials), lastTestedAt: provider.lastTestedAt?.toISOString(), lastTestSucceeded: provider.lastTestSucceeded ?? undefined }; }
  private mapPayment(payment: any) { return { id: payment.id, providerId: payment.providerId, providerName: payment.provider.name, providerType: payment.provider.type, method: payment.method, status: payment.status, amountCents: payment.amountCents, currency: payment.currency, externalReference: payment.externalReference ?? undefined, paidAt: payment.paidAt?.toISOString(), createdAt: payment.createdAt.toISOString() }; }
}
