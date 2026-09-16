import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EventPublisher } from '@delivereats/backend-kit';
import { DriverStatus, PrismaClient, VehicleType } from './generated/prisma';
import { DriversService } from './drivers.service';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.DRIVERS_TEST_DATABASE_URL;
if (databaseUrl && (process.env.NODE_ENV !== 'test' || !/^\/delivereats_test_[a-z0-9_]+$/.test(new URL(databaseUrl).pathname))) throw new Error('Las pruebas solo pueden usar una base aislada delivereats_test_*');
const integration = databaseUrl ? describe : describe.skip;

integration('atomic driver assignment (PostgreSQL)', () => {
  const userIds = Array.from({ length: 3 }, () => randomUUID());
  const orderIds = Array.from({ length: 48 }, () => randomUUID());
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const service = new DriversService(
    prisma as never,
    { set: vi.fn(), get: vi.fn(), ping: vi.fn() } as never,
    { emitLocation: vi.fn() } as never,
    new EventPublisher(prisma),
    {} as never,
  );

  beforeAll(async () => {
    await prisma.driverProfile.createMany({
      data: Array.from({ length: 3 }, (_, index) => ({
        userId: userIds[index]!,
        documentNumber: randomUUID(),
        vehicleType: VehicleType.MOTORCYCLE,
        status: DriverStatus.AVAILABLE,
        approvedAt: new Date(),
        applicationStatus: 'APPROVED',
        lastLocationAt: new Date(),
        currentLatitude: -13.16 + index * 0.001,
        currentLongitude: -74.22 + index * 0.001,
      })),
    });
  });

  afterAll(async () => {
    await prisma.driverAssignment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.assignmentRequest.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.driverProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('never assigns one driver to two active orders under concurrent requests', async () => {
    const offers = await Promise.all(
      Array.from({ length: 48 }, (_, index) =>
        service.offer({
          orderId: orderIds[index]!,
          pickupPoints: [
            {
              merchantId: randomUUID(),
              name: 'Punto efímero de prueba',
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
  }, 60_000);
});
