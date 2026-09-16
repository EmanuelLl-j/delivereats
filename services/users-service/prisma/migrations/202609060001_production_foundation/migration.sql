-- CreateEnum
CREATE TYPE "public"."LegalDocumentType" AS ENUM ('GENERAL_TERMS', 'PRIVACY_POLICY', 'SHIPPING_TERMS', 'PROHIBITED_ITEMS_POLICY', 'DRIVER_TERMS', 'MERCHANT_TERMS');

-- CreateEnum
CREATE TYPE "public"."LegalDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."legal_documents" (
    "id" UUID NOT NULL,
    "type" "public"."LegalDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public"."LegalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."legal_acceptances" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "legalDocumentId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_verifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."privacy_requests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "resolvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consent_preferences" (
    "userId" UUID NOT NULL,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."support_tickets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orderId" UUID,
    "type" TEXT NOT NULL DEFAULT 'SUPPORT',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "resolvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."file_assets" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_documents_type_status_effectiveAt_idx" ON "public"."legal_documents"("type", "status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_version_key" ON "public"."legal_documents"("type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "legal_acceptances_userId_legalDocumentId_key" ON "public"."legal_acceptances"("userId", "legalDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_tokenHash_key" ON "public"."email_verifications"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verifications_userId_createdAt_idx" ON "public"."email_verifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "privacy_requests_userId_status_idx" ON "public"."privacy_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "support_tickets_userId_status_idx" ON "public"."support_tickets"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_objectKey_key" ON "public"."file_assets"("objectKey");

-- CreateIndex
CREATE INDEX "file_assets_ownerUserId_purpose_idx" ON "public"."file_assets"("ownerUserId", "purpose");

-- AddForeignKey
ALTER TABLE "public"."legal_acceptances" ADD CONSTRAINT "legal_acceptances_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "public"."legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

