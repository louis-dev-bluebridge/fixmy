CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PRO', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "ProApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'ASSIGNED', 'PRO_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" CITEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "role" "UserRole" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "ClientProfile" (
  "userId" UUID NOT NULL,
  CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ProProfile" (
  "userId" UUID NOT NULL,
  "profession" TEXT NOT NULL,
  "bio" TEXT,
  "approvalStatus" "ProApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "rating" DECIMAL(3,2) NOT NULL DEFAULT 5.0,
  "completedJobs" INTEGER NOT NULL DEFAULT 0,
  "isOnline" BOOLEAN NOT NULL DEFAULT FALSE,
  "latitude" DOUBLE PRECISION NOT NULL DEFAULT 50.8467,
  "longitude" DOUBLE PRECISION NOT NULL DEFAULT 4.3525,
  "location" geography(Point,4326),
  CONSTRAINT "ProProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ServiceCategory" (
  "id" UUID NOT NULL,
  "parentId" UUID,
  "slug" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "nameEs" TEXT NOT NULL,
  "nameFr" TEXT NOT NULL,
  "nameNl" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "namePt" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

CREATE TABLE "ProService" (
  "proId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  CONSTRAINT "ProService_pkey" PRIMARY KEY ("proId", "categoryId")
);

CREATE TABLE "Job" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "assignedProId" UUID,
  "categoryId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "budgetCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "servicePoint" geography(Point,4326),
  "etaMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Job_status_categoryId_idx" ON "Job"("status", "categoryId");

CREATE TABLE "JobHistory" (
  "id" UUID NOT NULL,
  "jobId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "status" "JobStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JobHistory_jobId_createdAt_idx" ON "JobHistory"("jobId", "createdAt");

ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProProfile" ADD CONSTRAINT "ProProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProService" ADD CONSTRAINT "ProService_proId_fkey" FOREIGN KEY ("proId") REFERENCES "ProProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProService" ADD CONSTRAINT "ProService_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_assignedProId_fkey" FOREIGN KEY ("assignedProId") REFERENCES "ProProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobHistory" ADD CONSTRAINT "JobHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobHistory" ADD CONSTRAINT "JobHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ProProfile_location_gist" ON "ProProfile" USING GIST ("location");
CREATE INDEX "Job_servicePoint_gist" ON "Job" USING GIST ("servicePoint");
