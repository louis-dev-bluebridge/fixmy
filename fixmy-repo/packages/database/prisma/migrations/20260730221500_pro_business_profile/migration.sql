ALTER TABLE "ProProfile"
ADD COLUMN "businessName" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "vatNumber" TEXT,
ADD COLUMN "serviceArea" TEXT NOT NULL DEFAULT 'Brussels',
ADD COLUMN "serviceRadiusKm" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN "hourlyRateCents" INTEGER,
ADD COLUMN "yearsExperience" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProProfile"
ADD CONSTRAINT "ProProfile_serviceRadiusKm_check" CHECK ("serviceRadiusKm" BETWEEN 1 AND 150),
ADD CONSTRAINT "ProProfile_hourlyRateCents_check" CHECK ("hourlyRateCents" IS NULL OR "hourlyRateCents" BETWEEN 0 AND 100000),
ADD CONSTRAINT "ProProfile_yearsExperience_check" CHECK ("yearsExperience" BETWEEN 0 AND 80);
