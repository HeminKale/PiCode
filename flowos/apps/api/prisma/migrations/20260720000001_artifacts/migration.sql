-- Apply manually with the documented pg-client workaround; do not use prisma migrate dev.
CREATE TABLE "Artifact" ("id" TEXT NOT NULL, "flowId" TEXT NOT NULL, "nodeId" TEXT NOT NULL, "kind" TEXT NOT NULL, "version" INTEGER NOT NULL, "sourceCode" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft', "isPublished" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Artifact_flowId_nodeId_kind_version_key" ON "Artifact"("flowId", "nodeId", "kind", "version");
CREATE INDEX "Artifact_flowId_nodeId_kind_isPublished_idx" ON "Artifact"("flowId", "nodeId", "kind", "isPublished");
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
