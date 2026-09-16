ALTER TABLE "device_tokens" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
-- Existing tokens must be explicitly re-registered by an authenticated installation.
UPDATE "device_tokens" SET "active" = false;
