-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('MARKETPLACE', 'PERSONAL_SHIPMENT');

-- CreateEnum
CREATE TYPE "public"."ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."ItemPolicyStatus" AS ENUM ('ALLOWED', 'RESTRICTED', 'PROHIBITED');

-- CreateEnum
CREATE TYPE "public"."ShipmentReviewStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRES_REVIEW', 'APPROVED', 'REJECTED', 'INVESTIGATION');

-- AlterEnum
ALTER TYPE "public"."OrderStatus" ADD VALUE 'REQUIRES_REVIEW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PaymentMethod" ADD VALUE 'YAPE_MANUAL';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'PLIN_MANUAL';

-- AlterEnum
ALTER TYPE "public"."PaymentStatus" ADD VALUE 'PAYMENT_PENDING_VERIFICATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PaymentProvider" ADD VALUE 'MANUAL';
ALTER TYPE "public"."PaymentProvider" ADD VALUE 'CASH';

-- AlterTable
ALTER TABLE "public"."merchants" ADD COLUMN     "applicationDocuments" JSONB,
ADD COLUMN     "applicationStatus" "public"."ApplicationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" UUID;

-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "type" "public"."OrderType" NOT NULL DEFAULT 'MARKETPLACE',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "deliveryAddressId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."sub_orders" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "preparingAt" TIMESTAMP(3),
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "public"."payment_intents" ADD COLUMN     "evidenceFileId" UUID,
ADD COLUMN     "operationCode" TEXT,
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewedBy" UUID;

-- CreateTable
CREATE TABLE "public"."item_policies" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."ItemPolicyStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."item_policy_revisions" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."ItemPolicyStatus" NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "actorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_policy_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."logistics_configs" (
    "vehicleType" TEXT NOT NULL,
    "maxWeightKg" DECIMAL(8,2) NOT NULL,
    "maxLengthCm" DECIMAL(8,2) NOT NULL,
    "maxWidthCm" DECIMAL(8,2) NOT NULL,
    "maxHeightCm" DECIMAL(8,2) NOT NULL,
    "baseFee" DECIMAL(10,2) NOT NULL,
    "perKmFee" DECIMAL(10,2) NOT NULL,
    "perKgFee" DECIMAL(10,2) NOT NULL,
    "perLiterFee" DECIMAL(10,4) NOT NULL,
    "serviceFee" DECIMAL(10,2) NOT NULL,
    "fragileFee" DECIMAL(10,2) NOT NULL,
    "maxDistanceKm" DECIMAL(8,2) NOT NULL,
    "cashAllowed" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_configs_pkey" PRIMARY KEY ("vehicleType")
);

-- CreateTable
CREATE TABLE "public"."shipment_quotes" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "input" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."personal_shipment_details" (
    "orderId" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "pickupReference" TEXT,
    "pickupLatitude" DECIMAL(10,7) NOT NULL,
    "pickupLongitude" DECIMAL(10,7) NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffReference" TEXT,
    "dropoffLatitude" DECIMAL(10,7) NOT NULL,
    "dropoffLongitude" DECIMAL(10,7) NOT NULL,
    "recipientName" TEXT NOT NULL,
    "packageCategory" TEXT NOT NULL,
    "contentDescription" TEXT NOT NULL,
    "weightKg" DECIMAL(8,2) NOT NULL,
    "lengthCm" DECIMAL(8,2) NOT NULL,
    "widthCm" DECIMAL(8,2) NOT NULL,
    "heightCm" DECIMAL(8,2) NOT NULL,
    "declaredValue" DECIMAL(10,2) NOT NULL,
    "fragile" BOOLEAN NOT NULL,
    "packageImageUrl" TEXT,
    "vehicleType" TEXT NOT NULL,
    "pickupVerificationCode" TEXT NOT NULL,
    "deliveryVerificationCode" TEXT NOT NULL,
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "verificationLockedUntil" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "pickupEvidenceFileId" UUID,
    "deliveryEvidenceFileId" UUID,
    "restrictionStatus" "public"."ItemPolicyStatus" NOT NULL,
    "reviewStatus" "public"."ShipmentReviewStatus" NOT NULL,
    "reviewReason" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "declarationEvidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_shipment_details_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "public"."payment_configurations" (
    "method" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "accountLabel" TEXT,
    "instructions" TEXT,
    "qrImageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_configurations_pkey" PRIMARY KEY ("method")
);

-- CreateTable
CREATE TABLE "public"."refunds" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentIntentId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedBy" UUID NOT NULL,
    "reviewedBy" UUID,
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_policies_category_key" ON "public"."item_policies"("category");

-- CreateIndex
CREATE UNIQUE INDEX "item_policy_revisions_policyId_version_key" ON "public"."item_policy_revisions"("policyId", "version");

-- CreateIndex
CREATE INDEX "shipment_quotes_customerId_expiresAt_idx" ON "public"."shipment_quotes"("customerId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "personal_shipment_details_quoteId_key" ON "public"."personal_shipment_details"("quoteId");

-- CreateIndex
CREATE INDEX "personal_shipment_details_reviewStatus_createdAt_idx" ON "public"."personal_shipment_details"("reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "refunds_orderId_status_idx" ON "public"."refunds"("orderId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "public"."audit_logs"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_providerPaymentId_key" ON "public"."payment_intents"("providerPaymentId");

-- AddForeignKey
ALTER TABLE "public"."item_policy_revisions" ADD CONSTRAINT "item_policy_revisions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."item_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."personal_shipment_details" ADD CONSTRAINT "personal_shipment_details_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve existing approved businesses without approving new applications.
UPDATE merchants SET "applicationStatus" = 'APPROVED' WHERE "isActive" = true;
