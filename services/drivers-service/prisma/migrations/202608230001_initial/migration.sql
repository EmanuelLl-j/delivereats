-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."DriverStatus" AS ENUM ('OFFLINE', 'AVAILABLE', 'RESERVED', 'BUSY', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('MOTORCYCLE', 'BICYCLE', 'CAR');

-- CreateEnum
CREATE TYPE "public"."AssignmentStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."AssignmentRequestStatus" AS ENUM ('SEARCHING', 'ASSIGNED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."driver_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "vehicleType" "public"."VehicleType" NOT NULL,
    "vehiclePlate" TEXT,
    "licenseNumber" TEXT,
    "status" "public"."DriverStatus" NOT NULL DEFAULT 'OFFLINE',
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 5,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "currentLatitude" DECIMAL(10,7),
    "currentLongitude" DECIMAL(10,7),
    "lastLocationAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_assignments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "status" "public"."AssignmentStatus" NOT NULL DEFAULT 'OFFERED',
    "estimatedEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pickupCount" INTEGER NOT NULL DEFAULT 1,
    "destination" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "driver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assignment_requests" (
    "orderId" UUID NOT NULL,
    "pickupPoints" JSONB NOT NULL,
    "destination" JSONB NOT NULL,
    "estimatedEarnings" DECIMAL(10,2) NOT NULL,
    "pickupCount" INTEGER NOT NULL,
    "status" "public"."AssignmentRequestStatus" NOT NULL DEFAULT 'SEARCHING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_requests_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "public"."location_samples" (
    "id" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "orderId" UUID,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "speed" DECIMAL(7,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_userId_key" ON "public"."driver_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_documentNumber_key" ON "public"."driver_profiles"("documentNumber");

-- CreateIndex
CREATE INDEX "driver_profiles_status_lastLocationAt_idx" ON "public"."driver_profiles"("status", "lastLocationAt");

-- CreateIndex
CREATE INDEX "driver_assignments_driverId_status_idx" ON "public"."driver_assignments"("driverId", "status");

-- CreateIndex
CREATE INDEX "driver_assignments_orderId_status_idx" ON "public"."driver_assignments"("orderId", "status");

-- CreateIndex
CREATE INDEX "assignment_requests_status_updatedAt_idx" ON "public"."assignment_requests"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "location_samples_driverId_createdAt_idx" ON "public"."location_samples"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "location_samples_orderId_createdAt_idx" ON "public"."location_samples"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."driver_assignments" ADD CONSTRAINT "driver_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."location_samples" ADD CONSTRAINT "location_samples_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
