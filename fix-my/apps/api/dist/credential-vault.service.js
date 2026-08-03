"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialVaultService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
let CredentialVaultService = class CredentialVaultService {
    key = (0, node_crypto_1.createHash)("sha256")
        .update(process.env.INTEGRATION_MASTER_KEY ?? "fix-my-local-integration-key-change-before-production")
        .digest();
    encrypt(value) {
        const iv = (0, node_crypto_1.randomBytes)(12);
        const cipher = (0, node_crypto_1.createCipheriv)("aes-256-gcm", this.key, iv);
        const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
        return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
    }
    decrypt(value) {
        if (!value)
            return {};
        const [iv, tag, encrypted] = value.split(".");
        if (!iv || !tag || !encrypted)
            return {};
        const decipher = (0, node_crypto_1.createDecipheriv)("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
        decipher.setAuthTag(Buffer.from(tag, "base64url"));
        return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8"));
    }
};
exports.CredentialVaultService = CredentialVaultService;
exports.CredentialVaultService = CredentialVaultService = __decorate([
    (0, common_1.Injectable)()
], CredentialVaultService);
