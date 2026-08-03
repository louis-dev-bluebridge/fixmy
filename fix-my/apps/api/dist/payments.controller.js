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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const payments_service_1 = require("./payments.service");
let PaymentsController = class PaymentsController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    methods() { return this.payments.methods(); }
    checkout(user, body) { return this.payments.checkout(user, body); }
    confirmMock(user, id, body) { return this.payments.confirmMock(user, id, body.outcome); }
    stripeWebhook(signature, request) { return this.payments.handleStripeWebhook(signature, request.rawBody ?? Buffer.alloc(0)); }
    providers() { return this.payments.providers(); }
    saveProvider(body) { return this.payments.saveProvider(body); }
    updateProvider(id, body) { return this.payments.saveProvider({ ...body, id }); }
    testProvider(id) { return this.payments.testProvider(id); }
    transactions() { return this.payments.adminPayments(); }
    refund(user, id, body) { return this.payments.refund(user, id, body); }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, auth_1.Roles)("CLIENT"),
    (0, common_1.Get)("methods"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "methods", null);
__decorate([
    (0, auth_1.Roles)("CLIENT"),
    (0, common_1.Post)("checkout"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "checkout", null);
__decorate([
    (0, auth_1.Roles)("CLIENT"),
    (0, common_1.Post)(":id/mock-confirm"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "confirmMock", null);
__decorate([
    (0, auth_1.Public)(),
    (0, common_1.Post)("webhooks/stripe"),
    __param(0, (0, common_1.Headers)("stripe-signature")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "stripeWebhook", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, common_1.Get)("admin/providers"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "providers", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, common_1.Post)("admin/providers"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "saveProvider", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, common_1.Patch)("admin/providers/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "updateProvider", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, common_1.Post)("admin/providers/:id/test"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "testProvider", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, common_1.Get)("admin/transactions"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "transactions", null);
__decorate([
    (0, auth_1.Roles)("ADMIN"),
    (0, common_1.Post)("admin/transactions/:id/refund"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "refund", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)("payments"),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
