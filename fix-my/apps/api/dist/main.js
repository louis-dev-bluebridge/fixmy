"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter({ logger: true, bodyLimit: 1048576 }), { rawBody: true });
    app.enableCors({ origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"], credentials: true });
    app.setGlobalPrefix("api", { exclude: ["health"] });
    const config = new swagger_1.DocumentBuilder()
        .setTitle("FIX MY API")
        .setDescription("API local del marketplace FIX MY")
        .setVersion("0.1.0")
        .build();
    swagger_1.SwaggerModule.setup("docs", app, swagger_1.SwaggerModule.createDocument(app, config));
    await app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0");
}
void bootstrap();
