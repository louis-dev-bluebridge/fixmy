import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { SystemExceptionFilter } from "./system-exception.filter";
import { SystemLogService } from "./system-log.service";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, bodyLimit: 1048576 }),
    { rawBody: true },
  );

  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001,http://localhost:3002").split(",").map(item => item.trim()), credentials: true });
  app.useGlobalFilters(new SystemExceptionFilter(app.get(SystemLogService)));
  app.setGlobalPrefix("api", { exclude: ["health"] });

  const config = new DocumentBuilder()
    .setTitle("FIX MY API")
    .setDescription("API local del marketplace FIX MY")
    .setVersion("0.1.0")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  await app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0");
}

void bootstrap();
