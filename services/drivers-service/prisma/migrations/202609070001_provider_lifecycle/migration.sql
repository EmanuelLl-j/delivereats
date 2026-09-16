ALTER TABLE "driver_profiles" ALTER COLUMN "rating" SET DEFAULT 0;
ALTER TABLE "call_sessions" ADD COLUMN "providerClosedAt" TIMESTAMP(3);
CREATE INDEX "call_sessions_pending_close_idx" ON "call_sessions" ("endedAt") WHERE "providerClosedAt" IS NULL;
