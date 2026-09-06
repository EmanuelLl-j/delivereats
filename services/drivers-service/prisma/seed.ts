import { DriverStatus, PrismaClient, VehicleType } from '../src/generated/prisma';

const prisma = new PrismaClient();

const drivers = [
  {
    id: '91000000-0000-4000-8000-000000000001',
    userId: '22222222-2222-4222-8222-222222222222',
    documentNumber: '70100001',
    vehicleType: VehicleType.MOTORCYCLE,
    vehiclePlate: 'AY-4102',
    licenseNumber: 'Q70100001',
    currentLatitude: -13.1592,
    currentLongitude: -74.2241,
  },
  {
    id: '92000000-0000-4000-8000-000000000002',
    userId: '22222222-2222-4222-8222-222222222223',
    documentNumber: '70100002',
    vehicleType: VehicleType.BICYCLE,
    vehiclePlate: null,
    licenseNumber: null,
    currentLatitude: -13.168,
    currentLongitude: -74.229,
  },
  {
    id: '93000000-0000-4000-8000-000000000003',
    userId: '22222222-2222-4222-8222-222222222224',
    documentNumber: '70100003',
    vehicleType: VehicleType.MOTORCYCLE,
    vehiclePlate: 'AY-6388',
    licenseNumber: 'Q70100003',
    currentLatitude: -13.172,
    currentLongitude: -74.221,
  },
] as const;

async function main() {
  // Keep the demo environment repeatable after interrupted delivery flows.
  await prisma.$transaction([
    prisma.locationSample.deleteMany(),
    prisma.driverAssignment.deleteMany(),
    prisma.assignmentRequest.deleteMany(),
  ]);
  for (const driver of drivers) {
    await prisma.driverProfile.upsert({
      where: { id: driver.id },
      update: {
        status: DriverStatus.AVAILABLE,
        currentLatitude: driver.currentLatitude,
        currentLongitude: driver.currentLongitude,
        lastLocationAt: new Date(),
        approvedAt: new Date(),
      },
      create: {
        ...driver,
        status: DriverStatus.AVAILABLE,
        rating: 4.9,
        lastLocationAt: new Date(),
        approvedAt: new Date(),
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
