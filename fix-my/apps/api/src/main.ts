import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, bodyLimit: 1048576 }),
    { rawBody: true },
  );

  app.enableCors({ origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"], credentials: true });
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
