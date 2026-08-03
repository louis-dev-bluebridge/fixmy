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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const stripe_1 = __importDefault(require("stripe"));
const prisma_service_1 = require("./prisma.service");
const credential_vault_service_1 = require("./credential-vault.service");
const activity_service_1 = require("./activity.service");
const METHOD_LABELS = {
    mock_card: "Tarjeta de prueba",
    mock_bancontact: "Bancontact de prueba",
    card: "Tarjeta",
    bancontact: "Bancontact",
    paypal: "PayPal",
    payconiq: "Payconiq",
};
let PaymentsService = class PaymentsService {
    db;
    vault;
    activity;
    constructor(db, vault, activity) {
        this.db = db;
        this.vault = vault;
        this.activity = activity;
    }
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
    async saveProvider(input) {
        if (!input.name?.trim() || !input.supportedMethods?.length)
            throw new common_1.BadRequestException("Name and payment methods are required");
        const encryptedCredentials = input.credentials && Object.values(input.credentials).some(Boolean) ? this.vault.encrypt(input.credentials) : undefined;
        const data = { type: input.type, name: input.name.trim(), supportedMethods: input.supportedMethods, mode: input.mode ?? "test", publicKey: input.publicKey || null, isActive: input.isActive ?? false, priority: input.priority ?? 0, ...(encryptedCredentials ? { encryptedCredentials } : {}) };
        const provider = input.id ? await this.db.paymentProvider.update({ where: { id: input.id }, data }) : await this.db.paymentProvider.create({ data });
        return this.mapProvider(provider);
    }
    async testProvider(id) {
        const provider = await this.db.paymentProvider.findUnique({ where: { id } });
        if (!provider)
            throw new common_1.NotFoundException("Payment provider not found");
        const credentials = this.vault.decrypt(provider.encryptedCredentials);
        const succeeds = provider.type === "MOCK" || (provider.type === "STRIPE" && Boolean(credentials.secretKey && provider.publicKey)) || ((provider.type === "PAYPAL" || provider.type === "PAYCONIQ") && Boolean(credentials.clientId && credentials.clientSecret)) || (provider.type === "GENERIC_REST" && Boolean(credentials.baseUrl));
        await this.db.paymentProvider.update({ where: { id }, data: { lastTestedAt: new Date(), lastTestSucceeded: succeeds } });
        return { succeeds, message: succeeds ? "Configuration is ready" : "Required credentials are missing" };
    }
    async checkout(user, input) {
        const job = await this.db.job.findUnique({ where: { id: input.jobId }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
        if (!job || job.clientId !== user.id)
            throw new common_1.NotFoundException("Job not found");
        if (!["DRAFT", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(job.status))
            throw new common_1.ConflictException("This job can no longer be paid");
        const provider = await this.db.paymentProvider.findUnique({ where: { id: input.providerId } });
        if (!provider?.isActive || !provider.supportedMethods.includes(input.method))
            throw new common_1.BadRequestException("Payment method is not available");
        const idempotencyKey = input.idempotencyKey ?? `${job.id}:${provider.id}:${input.method}`;
        const existing = await this.db.payment.findUnique({ where: { idempotencyKey }, include: { provider: true } });
        if (existing)
            return this.checkoutResponse(existing);
        let externalReference;
        let clientSecret;
        if (provider.type === "STRIPE") {
            const credentials = this.vault.decrypt(provider.encryptedCredentials);
            if (!credentials.secretKey || !provider.publicKey)
                throw new common_1.BadRequestException("Stripe credentials are incomplete");
            const stripe = new stripe_1.default(credentials.secretKey);
            const intent = await stripe.paymentIntents.create({ amount: job.budgetCents, currency: job.currency.toLowerCase(), payment_method_types: [input.method], metadata: { jobId: job.id, clientId: user.id } }, { idempotencyKey });
            externalReference = intent.id;
            clientSecret = intent.client_secret ?? undefined;
        }
        const payment = await this.db.$transaction(async (tx) => {
            await tx.job.update({ where: { id: job.id }, data: { status: "PAYMENT_PENDING" } });
            return tx.payment.create({ data: { jobId: job.id, providerId: provider.id, method: input.method, status: provider.type === "MOCK" ? "REQUIRES_ACTION" : "PENDING", amountCents: job.budgetCents, currency: job.currency, idempotencyKey, checkoutReference: (0, node_crypto_1.randomUUID)(), externalReference }, include: { provider: true } });
        });
        return { ...this.checkoutResponse(payment), clientSecret };
    }
    async confirmMock(user, paymentId, outcome) {
        const payment = await this.db.payment.findUnique({ where: { id: paymentId }, include: { provider: true, job: true } });
        if (!payment || payment.job.clientId !== user.id)
            throw new common_1.NotFoundException("Payment not found");
        if (payment.provider.type !== "MOCK")
            throw new common_1.BadRequestException("Only test payments can be confirmed here");
        if (payment.status === "SUCCEEDED")
            return this.mapPayment(payment);
        const eventId = `mock:${payment.id}:${outcome}`;
        const updated = await this.db.$transaction(async (tx) => {
            const seen = await tx.paymentEvent.findUnique({ where: { externalEventId: eventId } });
            if (seen)
                return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { provider: true } });
            await tx.paymentEvent.create({ data: { paymentId: payment.id, externalEventId: eventId, type: outcome === "success" ? "payment.succeeded" : "payment.failed", payload: { source: "local-test" } } });
            const result = await tx.payment.update({ where: { id: payment.id }, data: outcome === "success" ? { status: "SUCCEEDED", paidAt: new Date(), externalReference: `mock_${(0, node_crypto_1.randomUUID)()}` } : { status: "FAILED", failureMessage: "Pago rechazado en modo de prueba" }, include: { provider: true } });
            await tx.job.update({ where: { id: payment.jobId }, data: { status: outcome === "success" ? "OPEN" : "PAYMENT_FAILED" } });
            await tx.jobHistory.create({ data: { jobId: payment.jobId, actorId: user.id, status: outcome === "success" ? "OPEN" : "PAYMENT_FAILED" } });
            return result;
        });
        return this.mapPayment(updated);
    }
    async handleStripeWebhook(signature, rawBody) {
        const provider = await this.db.paymentProvider.findFirst({ where: { type: "STRIPE", isActive: true } });
        if (!provider)
            throw new common_1.NotFoundException("Active Stripe provider not found");
        const credentials = this.vault.decrypt(provider.encryptedCredentials);
        if (!credentials.secretKey || !credentials.webhookSecret || !signature)
            throw new common_1.BadRequestException("Stripe webhook is not configured");
        const stripe = new stripe_1.default(credentials.secretKey);
        let event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, credentials.webhookSecret);
        }
        catch {
            throw new common_1.BadRequestException("Invalid Stripe webhook signature");
        }
        const intent = event.data.object;
        const payment = await this.db.payment.findFirst({ where: { externalReference: intent.id }, include: { job: true } });
        if (!payment)
            return { received: true, ignored: true };
        const exists = await this.db.paymentEvent.findUnique({ where: { externalEventId: event.id } });
        if (exists)
            return { received: true, duplicate: true };
        const succeeded = event.type === "payment_intent.succeeded";
        const failed = event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled";
        await this.db.$transaction(async (tx) => {
            await tx.paymentEvent.create({ data: { paymentId: payment.id, externalEventId: event.id, type: event.type, payload: { paymentIntentId: intent.id } } });
            if (succeeded) {
                await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", paidAt: new Date() } });
                await tx.job.update({ where: { id: payment.jobId }, data: { status: "OPEN" } });
                await tx.jobHistory.create({ data: { jobId: payment.jobId, actorId: payment.job.clientId, status: "OPEN" } });
            }
            else if (failed) {
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
    async refund(user, paymentId, input) {
        const payment = await this.db.payment.findUnique({ where: { id: paymentId }, include: { provider: true } });
        if (!payment || payment.status !== "SUCCEEDED")
            throw new common_1.ConflictException("Only successful payments can be refunded");
        const amountCents = input.amountCents ?? payment.amountCents;
        if (amountCents <= 0 || amountCents > payment.amountCents)
            throw new common_1.BadRequestException("Invalid refund amount");
        if (payment.provider.type !== "MOCK")
            throw new common_1.BadRequestException("This provider requires its external refund API");
        return this.db.$transaction(async (tx) => {
            const refund = await tx.refund.create({ data: { paymentId, requestedById: user.id, amountCents, reason: input.reason ?? "Admin refund", status: "SUCCEEDED", externalReference: `mock_refund_${(0, node_crypto_1.randomUUID)()}` } });
            await tx.payment.update({ where: { id: paymentId }, data: { status: amountCents === payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
            await tx.activityLog.create({ data: { actorId: user.id, action: "PAYMENT_REFUNDED", entityType: "PAYMENT", entityId: paymentId, summary: `${user.name} reembolsó €${(amountCents / 100).toFixed(2)}`, metadata: { amountCents, reason: input.reason ?? "Admin refund" } } });
            return refund;
        });
    }
    checkoutResponse(payment) { return { payment: this.mapPayment(payment), mode: payment.provider.type === "MOCK" ? "mock" : payment.provider.type === "STRIPE" ? "stripe" : "redirect" }; }
    mapProvider(provider) { return { id: provider.id, type: provider.type, name: provider.name, supportedMethods: provider.supportedMethods, mode: provider.mode, isActive: provider.isActive, priority: provider.priority, publicKey: provider.publicKey ?? undefined, hasCredentials: Boolean(provider.encryptedCredentials), lastTestedAt: provider.lastTestedAt?.toISOString(), lastTestSucceeded: provider.lastTestSucceeded ?? undefined }; }
    mapPayment(payment) { return { id: payment.id, providerId: payment.providerId, providerName: payment.provider.name, providerType: payment.provider.type, method: payment.method, status: payment.status, amountCents: payment.amountCents, currency: payment.currency, externalReference: payment.externalReference ?? undefined, paidAt: payment.paidAt?.toISOString(), createdAt: payment.createdAt.toISOString() }; }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, credential_vault_service_1.CredentialVaultService, activity_service_1.ActivityService])
], PaymentsService);
