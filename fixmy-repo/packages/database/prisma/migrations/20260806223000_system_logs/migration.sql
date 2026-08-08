CREATE TABLE "SystemLog" (
    "id" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "method" TEXT,
    "path" TEXT,
    "statusCode" INTEGER,
    "requestId" TEXT,
    "actorId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");
CREATE INDEX "SystemLog_source_createdAt_idx" ON "SystemLog"("source", "createdAt");
CREATE INDEX "SystemLog_path_createdAt_idx" ON "SystemLog"("path", "createdAt");
CREATE INDEX "SystemLog_requestId_idx" ON "SystemLog"("requestId");
