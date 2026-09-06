import { PrismaClient, UserRole } from '../src/generated/prisma';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

const demoUsers = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    firstName: 'Ana',
    lastName: 'Quispe',
    email: 'cliente@delivereats.local',
    phone: '+51951000001',
    role: UserRole.CUSTOMER,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    firstName: 'Luis',
    lastName: 'Huamán',
    email: 'driver@delivereats.local',
    phone: '+51951000002',
    role: UserRole.DRIVER,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    firstName: 'María',
    lastName: 'Cárdenas',
    email: 'comercio@delivereats.local',
    phone: '+51951000003',
    role: UserRole.MERCHANT,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    firstName: 'Diego',
    lastName: 'Palomino',
    email: 'admin@delivereats.local',
    phone: '+51951000004',
    role: UserRole.ADMIN,
  },
] as const;

async function main() {
  const passwordHash = await hash('Demo12345!', 10);
  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        status: 'ACTIVE',
      },
      create: { ...user, passwordHash },
    });
  }

  const profile = await prisma.customerProfile.upsert({
    where: { userId: demoUsers[0].id },
    update: {},
    create: {
      id: 'aaaaaaaa-1111-4111-8111-111111111111',
      userId: demoUsers[0].id,
      loyaltyPoints: 120,
      level: 'BRONCE',
      preferences: { language: 'es-PE', notifications: true },
    },
  });
  await prisma.address.upsert({
    where: { id: 'aaaaaaaa-2222-4222-8222-222222222222' },
    update: {},
    create: {
      id: 'aaaaaaaa-2222-4222-8222-222222222222',
      customerId: profile.id,
      label: 'Casa',
      address: 'Jr. 28 de Julio 325, Ayacucho',
      reference: 'A media cuadra de la Plaza Mayor',
      district: 'Ayacucho',
      province: 'Huamanga',
      department: 'Ayacucho',
      latitude: -13.1603,
      longitude: -74.2257,
      isDefault: true,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
