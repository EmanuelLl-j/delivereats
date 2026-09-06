import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DriverStatus, PrismaClient, VehicleType } from './generated/prisma';
import { DriversService } from './drivers.service';

const databaseUrl = process.env.DRIVERS_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('atomic driver assignment (PostgreSQL)', () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const service = new DriversService(
    prisma as never,
    { set: vi.fn(), get: vi.fn(), ping: vi.fn() } as never,
    { emitLocation: vi.fn() } as never,
    { publish: vi.fn(async () => true) } as never,
  );

  beforeAll(async () => {
    await prisma.driverAssignment.deleteMany();
    await prisma.assignmentRequest.deleteMany();
    await prisma.locationSample.deleteMany();
    await prisma.driverProfile.deleteMany();
    await prisma.driverProfile.createMany({
      data: Array.from({ length: 3 }, (_, index) => ({
        userId: `22222222-2222-4222-8222-22222222222${index}`,
        documentNumber: `7010000${index}`,
        vehicleType: VehicleType.MOTORCYCLE,
        status: DriverStatus.AVAILABLE,
        approvedAt: new Date(),
        currentLatitude: -13.16 + index * 0.001,
        currentLongitude: -74.22 + index * 0.001,
      })),
    });
  });

  afterAll(async () => prisma.$disconnect());

  it('never assigns one driver to two active orders under concurrent requests', async () => {
    const offers = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        service.offer({
          orderId: `a0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          pickupPoints: [
            {
              merchantId: '51000000-0000-4000-8000-000000000001',
              name: 'Botica San Gabriel',
              latitude: -13.1588,
              longitude: -74.2236,
            },
          ],
          destination: { address: 'Ayacucho', latitude: -13.1603, longitude: -74.2257 },
          estimatedEarnings: 8,
        }),
      ),
    );
    const driverIds = offers.flatMap((offer) => (offer.driverId ? [offer.driverId] : []));
    expect(new Set(driverIds).size).toBe(driverIds.length);
    expect(driverIds).toHaveLength(3);
  });
});
