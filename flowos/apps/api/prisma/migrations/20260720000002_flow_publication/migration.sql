-- Apply manually with the documented pg-client workaround; do not use prisma migrate dev.
ALTER TABLE "Flow" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Flow" ADD COLUMN "icon" TEXT;
ALTER TABLE "Flow" ADD COLUMN "category" TEXT;
CREATE INDEX "Flow_isPublished_updatedAt_idx" ON "Flow"("isPublished", "updatedAt");
