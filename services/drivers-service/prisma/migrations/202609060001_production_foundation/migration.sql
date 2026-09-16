-- CreateEnum
CREATE TYPE "public"."DriverApplicationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "public"."driver_profiles" ADD COLUMN     "applicationStatus" "public"."DriverApplicationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "documents" JSONB,
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewedBy" UUID;

-- AlterTable
ALTER TABLE "public"."assignment_requests" ADD COLUMN     "vehicleTypes" JSONB;

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderUserId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "clientMessageId" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."call_sessions" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "callerUserId" UUID NOT NULL,
    "calleeUserId" UUID NOT NULL,
    "roomName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RINGING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "conversations_orderId_key" ON "public"."conversations"("orderId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "public"."messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_recipientUserId_readAt_idx" ON "public"."messages"("recipientUserId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_senderUserId_clientMessageId_key" ON "public"."messages"("senderUserId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_roomName_key" ON "public"."call_sessions"("roomName");

-- CreateIndex
CREATE INDEX "call_sessions_orderId_status_idx" ON "public"."call_sessions"("orderId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "public"."audit_logs"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


UPDATE driver_profiles SET "applicationStatus" = 'APPROVED' WHERE "approvedAt" IS NOT NULL;
