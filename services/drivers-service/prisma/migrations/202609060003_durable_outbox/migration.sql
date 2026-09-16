CREATE TABLE "event_outbox" (
  "id" UUID NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3)
);
CREATE INDEX "event_outbox_publishedAt_createdAt_idx" ON "event_outbox" ("publishedAt", "createdAt");
